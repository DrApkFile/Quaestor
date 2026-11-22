import type { BrowserContext, Page } from '@playwright/test';
import { fixture } from './m6Fixtures.js';
export function privacyMonitor(context: BrowserContext) {
  const pending: Promise<void>[] = [];
  const leaks: string[] = [];
  const errors: string[] = [];
  let requests = 0,
    responses = 0;
  const inspect = async (page: Page, text: string) => {
    const direct = [fixture.password, ...fixture.canaries].some(
      (value) =>
        text.includes(value) ||
        text.toLowerCase().includes(Buffer.from(value).toString('hex')) ||
        text.includes(Buffer.from(value).toString('base64')),
    );
    if (direct || (await page.evaluate((input) => window.quaestorPrivateCheck?.(input) ?? false, text)))
      leaks.push('PRIVATE_MATERIAL');
  };
  context.on('page', (page) => {
    page.on('pageerror', (error) => {
      errors.push(error.name);
    });
  });
  context.on('response', (response) => {
    const work = (async () => {
      const request = response.request();
      if (!request.frame().page().isClosed()) {
        const bytes = await response.body();
        responses++;
        await inspect(request.frame().page(), bytes.toString('utf8') + '\n' + bytes.toString('hex'));
      }
    })().catch(() => {
      errors.push('RESPONSE_INSPECTION_FAILED');
    });
    pending.push(work);
  });
  const start = () =>
    context.route('**/*', async (route) => {
      requests++;
      const request = route.request();
      const text = request.url() + JSON.stringify(await request.allHeaders()) + (request.postData() ?? '');
      await inspect(request.frame().page(), text);
      if (leaks.length) await route.abort();
      else await route.continue();
    });
  return {
    start,
    async finish() {
      await Promise.all(pending);
      return { requests, responses, leaks: leaks.length, errors };
    },
  };
}
