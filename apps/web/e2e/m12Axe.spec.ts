import { test, expect, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import AxeBuilder from '@axe-core/playwright';
import { m9Privacy } from './m9Privacy.js';
import { m9Fixtures } from './m9Fixtures.js';
import { m9Download, m9Navigate } from './m9Driver.js';
test('T-M12 all requested pages pass unfiltered axe at 390 and 1440 and the deterministic judge book still verifies', async ({
  browser,
  baseURL,
}) => {
  const fixture = m9Fixtures();
  const context = await browser.newContext();
  const monitor = m9Privacy(context, [fixture.password]);
  await monitor.start();
  let broadcasts = 0;
  await context.route('**/*', async (route) => {
    if (/eth_sendRawTransaction|eth_sendTransaction|broadcast_tx/.test(route.request().postData() ?? '')) {
      broadcasts++;
      await route.abort();
    } else await route.fallback();
  });
  const page = await context.newPage();
  const results: {
    page: string;
    state: string;
    width: number;
    fits: boolean;
    passes: number;
    incomplete: string[];
    violations: {
      id: string;
      impact: string | null | undefined;
      description: string;
      helpUrl: string;
      nodes: { target: unknown; reason: string | undefined }[];
    }[];
  }[] = [];
  const failures: string[] = [];
  let legacyJudgeVerified = false;
  const scan = async (page: Page, name: string, state: string) => {
    await expect(page.locator('h1:visible')).toBeVisible({ timeout: 60000 });
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      const axe = await new AxeBuilder({ page }).analyze();
      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
      results.push({
        page: name,
        state,
        width,
        fits,
        passes: axe.passes.length,
        incomplete: axe.incomplete.map(({ id }) => id),
        violations: axe.violations.map(({ id, impact, description, helpUrl, nodes }) => ({
          id,
          impact,
          description,
          helpUrl,
          nodes: nodes.map(({ target, failureSummary }) => ({ target, reason: failureSummary })),
        })),
      });
      console.log(
        `M12 axe ${name} ${state} ${String(width)}: ${String(axe.violations.length)} violations, fits=${String(fits)}`,
      );
    }
  };
  try {
    for (const [name, path] of [
      ['Landing', '/'],
      ['Account', '/app?view=account'],
      ['Public check', '/app?view=public'],
      ['Auditor', '/app?view=auditor'],
      ['Attack lab', '/attack-lab'],
    ] as const) {
      await page.goto(path);
      await scan(page, name, 'initial');
      if (name === 'Public check') {
        await page.getByRole('button', { name: 'Check chain', exact: true }).click();
        await expect(page.getByText('anchored entries', { exact: true })).toBeVisible({ timeout: 300000 });
        await scan(page, name, 'chain results');
      }
      if (name === 'Auditor') {
        await page.getByRole('button', { name: 'Try the demo auditor', exact: true }).click();
        await expect(page.getByTestId('entry-verdict')).toHaveCount(5, { timeout: 600000 });
        for (const badge of await page.getByTestId('entry-verdict').all())
          await expect(badge).toHaveAttribute('data-code', 'MATCHED');
        await expect(page.getByTestId('period-verdict')).toHaveCount(2);
        for (const badge of await page.getByTestId('period-verdict').all())
          await expect(badge).toHaveAttribute('data-code', 'HOLDINGS_COVER_BOOKS');
        await expect(page.locator('[data-code=NOT_GRANTED]')).toHaveCount(1);
        legacyJudgeVerified = true;
        await scan(page, name, 'verified deterministic judge records');
      }
      if (name === 'Attack lab') {
        await page.getByRole('button', { name: 'Read attack book from chain', exact: true }).click();
        await expect(page.getByTestId('attack-duplicate')).toBeVisible({ timeout: 600000 });
        await scan(page, name, 'chain results');
      }
    }
    const business = fixture.roles.business;
    if (!business) throw new Error('BUSINESS_FIXTURE_REQUIRED');
    await page.goto('/app?view=account');
    await page.getByLabel('Passphrase', { exact: true }).fill(fixture.password);
    await page.getByLabel('Restore encrypted backup', { exact: true }).setInputFiles(business.backup);
    await m9Download(page, '../../.accounts/m12/axe-readback-backup.json');
    await scan(page, 'Account', 'unlocked');
    for (const name of ['Wallet', 'Pay', 'Books', 'Grants']) {
      await m9Navigate(page, name);
      await scan(page, name, 'unlocked');
    }
    await page.waitForLoadState('networkidle');
  } catch (error: unknown) {
    failures.push(error instanceof Error ? error.name : 'UNKNOWN_ERROR');
  }
  const network = await monitor.finish();
  const passed =
    results.length === 26 &&
    results.every((result) => result.violations.length === 0 && result.fits) &&
    failures.length === 0 &&
    legacyJudgeVerified &&
    broadcasts === 0 &&
    network.leaks === 0 &&
    network.errors.length === 0 &&
    network.pendingInspections === 0 &&
    network.requests === network.responses;
  writeFileSync(
    '../../evidence/m12-axe.json',
    JSON.stringify(
      {
        command: 'pnpm evidence --m12-axe',
        commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        at: new Date().toISOString(),
        origin: baseURL,
        status: passed ? 'PASSED' : 'FAILED',
        axeTagFilter: null,
        results,
        failures,
        legacyJudgeVerified,
        broadcasts,
        network,
        remainingFindingReasons: results.flatMap((result) =>
          result.violations.map((violation) => ({
            page: result.page,
            state: result.state,
            width: result.width,
            id: violation.id,
            reason: 'Unresolved; see exact affected nodes and axe failure summaries in results.',
          })),
        ),
      },
      null,
      2,
    ) + '\n',
  );
  await context.close();
  expect(passed).toBe(true);
});
