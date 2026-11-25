import type { BrowserContext, Page } from '@playwright/test';
export function m9Privacy(context: BrowserContext, passwords: readonly string[]) {
  const pending = new Set<Promise<void>>();
  const errors: string[] = [];
  let requests = 0,
    responses = 0,
    leaks = 0;
  const secrets = passwords
    .flatMap((value) => [
      value,
      Buffer.from(value).toString('hex'),
      Buffer.from(value).toString('base64'),
      encodeURIComponent(value),
    ])
    .filter((value) => value.length > 20);
  const inspect = async (page: Page, text: string, navigation = false) => {
    if (
      secrets.some((secret) => text.includes(secret)) ||
      (!navigation && (await page.evaluate((input) => window.quaestorPrivateCheck?.(input) ?? false, text)))
    )
      leaks++;
  };
  const track = (work: Promise<void>) => {
    const handled = work
      .catch(() => {
        errors.push('INSPECTION_FAILED');
      })
      .finally(() => {
        pending.delete(handled);
      });
    pending.add(handled);
  };
  context.on('page', (page) => {
    page.on('pageerror', () => {
      errors.push('PAGE_ERROR');
    });
  });
  context.on('requestfailed', () => {
    errors.push('REQUEST_FAILED');
  });
  context.on('response', (response) => {
    track(
      (async () => {
        const page = response.request().frame().page();
        await inspect(
          page,
          response.url() + JSON.stringify(await response.allHeaders()),
          response.request().isNavigationRequest(),
        );
        const bytes = await response.body();
        responses++;
        for (let offset = 0; offset < bytes.length; offset += 1048576) {
          const part = bytes.subarray(Math.max(0, offset - 262144), offset + 1048576);
          await inspect(
            page,
            part.toString('utf8') + '\n' + part.toString('hex'),
            response.request().isNavigationRequest(),
          );
        }
      })(),
    );
  });
  return {
    async start() {
      await context.route('**/*', async (route) => {
        requests++;
        const request = route.request();
        try {
          await inspect(
            request.frame().page(),
            request.url() + JSON.stringify(await request.allHeaders()) + (request.postData() ?? ''),
            request.isNavigationRequest(),
          );
          if (leaks) await route.abort();
          else await route.continue();
        } catch {
          errors.push('REQUEST_INSPECTION_FAILED');
          await route.abort();
        }
      });
    },
    async finish() {
      const deadline = Date.now() + 30000;
      while ((pending.size || requests !== responses) && Date.now() < deadline)
        await Promise.race([...pending, new Promise((resolve) => setTimeout(resolve, 250))]);
      return { requests, responses, leaks, errors, pendingInspections: pending.size };
    },
  };
}
