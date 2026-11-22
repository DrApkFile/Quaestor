import type { BrowserContext, Page } from '@playwright/test';
import { fixture } from './m6Fixtures.js';
export function privacyMonitor(context: BrowserContext) {
  const pending: Promise<void>[] = [];
  const active = new Map<number, { path: string; phase: string }>();
  let responseSequence = 0;
  let sequence = 0;
  const leaks: string[] = [];
  const errors: string[] = [];
  let requests = 0,
    responses = 0;
  const inspect = async (page: Page, text: string, navigation = false) => {
    const direct = [fixture.password, ...fixture.canaries].some(
      (value) =>
        text.includes(value) ||
        text.toLowerCase().includes(Buffer.from(value).toString('hex')) ||
        text.includes(Buffer.from(value).toString('base64')),
    );
    if (
      direct ||
      (!navigation && (await page.evaluate((input) => window.quaestorPrivateCheck?.(input) ?? false, text)))
    )
      leaks.push('PRIVATE_MATERIAL');
  };
  context.on('page', (page) => {
    page.on('pageerror', (error) => {
      errors.push(error.name);
    });
  });
  context.on('response', (response) => {
    const id = ++responseSequence;
    const progress = { path: new URL(response.url()).pathname, phase: 'HEADERS' };
    active.set(id, progress);
    const work = (async () => {
      const request = response.request();
      console.log(`M6 response ${String(response.status())} ${new URL(request.url()).pathname}`);
      if (!request.frame().page().isClosed()) {
        const headers = await response.allHeaders();
        progress.phase = 'HEADER_PRIVACY_CHECK';
        await inspect(request.frame().page(), response.url() + JSON.stringify(headers), request.isNavigationRequest());
        progress.phase = 'BODY';
        const bytes = await response.body();
        responses++;
        progress.phase = 'PAYLOAD_PRIVACY_CHECK';
        for (let offset = 0; offset < bytes.length; offset += 1048576) {
          const part = bytes.subarray(Math.max(0, offset - 262144), offset + 1048576);
          await inspect(
            request.frame().page(),
            part.toString('utf8') + '\n' + part.toString('hex'),
            request.isNavigationRequest(),
          );
        }
      }
    })()
      .catch(() => {
        errors.push('RESPONSE_INSPECTION_FAILED');
      })
      .finally(() => {
        active.delete(id);
      });
    pending.push(work);
  });
  const start = async () => {
    await context.addInitScript(() => {
      const violations: string[] = [];
      Object.assign(window, { quaestorCspViolations: violations });
      window.addEventListener('securitypolicyviolation', (event) => {
        violations.push(event.violatedDirective);
      });
    });
    await context.route('**/*', async (route) => {
      requests++;
      const request = route.request();
      const id = ++sequence;
      console.log(`M6 request ${String(id)} ${request.method()} ${new URL(request.url()).pathname}`);
      const timer = setTimeout(() => {
        console.log(`M6 stalled request ${new URL(request.url()).pathname}`);
      }, 15000);
      const text = request.url() + JSON.stringify(await request.allHeaders()) + (request.postData() ?? '');
      await inspect(request.frame().page(), text, request.isNavigationRequest());
      if (leaks.length) await route.abort();
      else await route.continue();
      clearTimeout(timer);
      console.log(`M6 continued ${String(id)}`);
    });
  };
  return {
    start,
    async finish() {
      let inspectionTimeout: ReturnType<typeof setTimeout> | undefined;
      const completed = await Promise.race([
        Promise.all(pending).then(() => true),
        new Promise<boolean>((resolve) => {
          inspectionTimeout = setTimeout(() => {
            resolve(false);
          }, 30000);
        }),
      ]);
      clearTimeout(inspectionTimeout);
      if (!completed) errors.push('RESPONSE_INSPECTION_TIMEOUT');
      for (const page of context.pages()) {
        if (!page.isClosed()) {
          const violations: unknown = await page.evaluate(
            () => Reflect.get(window, 'quaestorCspViolations') as unknown,
          );
          if (Array.isArray(violations) && violations.length > 0) errors.push('CSP_VIOLATION');
        }
      }
      return { requests, responses, leaks: leaks.length, errors, pendingInspections: [...active.values()] };
    },
  };
}
