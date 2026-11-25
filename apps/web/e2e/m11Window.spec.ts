import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import AxeBuilder from '@axe-core/playwright';
import { z } from 'zod';
import { m9Privacy } from './m9Privacy.js';
import { m9Download, m9Navigate, m9Snapshot } from './m9Driver.js';
test('T-M11 cancellation clears completed proof progress at 390px without sending', async ({ browser, baseURL }) => {
  const session = z
    .object({ password: z.string() })
    .strict()
    .parse(JSON.parse(readFileSync('../../.accounts/m9-browser/signup-session.json', 'utf8')) as unknown);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const monitor = m9Privacy(context, [session.password]);
  await monitor.start();
  let broadcasts = 0;
  await context.route('**/*', async (route) => {
    if (/eth_sendRawTransaction|eth_sendTransaction|broadcast_tx/.test(route.request().postData() ?? '')) {
      broadcasts++;
      await route.abort();
    } else await route.fallback();
  });
  const page = await context.newPage();
  await page.goto('/app?view=account');
  await page.getByLabel('Passphrase', { exact: true }).fill(session.password);
  await page
    .getByLabel('Restore encrypted backup', { exact: true })
    .setInputFiles('../../.accounts/m9-browser/signup-backup.json');
  await m9Download(page, '../../.accounts/m9-browser/m11-readback-backup.json');
  await m9Navigate(page, 'Wallet');
  await expect(page.locator('.stats article').first().locator('strong')).toHaveText('1.5 QOR');
  for (const control of ['Escape', 'Cancel']) {
    if (control === 'Escape') await page.getByRole('button', { name: 'Cash out', exact: true }).click();
    else {
      await page.getByText(/^History \(/).click();
      await page.getByRole('button', { name: 'Resume prepared transaction', exact: true }).click();
    }
    const modal = page.getByRole('dialog', { name: 'Open a transaction window', exact: true });
    await expect(modal).toBeVisible({ timeout: 180000 });
    if (control === 'Escape') await expect(page.getByTestId('proof-progress')).toHaveText('Private proof ready.');
    if (control === 'Escape') await page.keyboard.press('Escape');
    else await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(modal).toHaveCount(0);
    await expect(page.locator('.workflow')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByTestId('workflow-error')).toHaveText('Cancelled. Nothing was sent.');
    await expect(page.getByTestId('proof-progress')).toHaveText('');
  }
  const operations = (await m9Snapshot(page)).operations.filter((operation) => operation.id.startsWith('cashout-'));
  expect(operations).toHaveLength(1);
  expect(operations[0]).toMatchObject({ stage: 'PROVED', hash: null });
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  await page.waitForLoadState('networkidle');
  const network = await monitor.finish();
  const passed =
    broadcasts === 0 &&
    fits &&
    axe.violations.length === 0 &&
    network.leaks === 0 &&
    network.errors.length === 0 &&
    network.pendingInspections === 0 &&
    network.requests === network.responses;
  writeFileSync(
    '../../evidence/m11-window.json',
    JSON.stringify(
      {
        command: 'pnpm evidence --m11-window',
        commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        at: new Date().toISOString(),
        origin: baseURL,
        status: passed ? 'PASSED' : 'FAILED',
        controls: ['Escape', 'Cancel'],
        progressCleared: true,
        preparedOperationKept: true,
        width: 390,
        fits,
        axeTags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
        axeViolations: axe.violations.map(({ id, impact }) => ({ id, impact })),
        broadcasts,
        network,
      },
      null,
      2,
    ) + '\n',
  );
  await context.close();
  expect(passed).toBe(true);
});
