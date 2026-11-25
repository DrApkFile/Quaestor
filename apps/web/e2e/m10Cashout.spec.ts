import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { m9Privacy } from './m9Privacy.js';
import { m9Navigate, m9Download, m9Snapshot } from './m9Driver.js';
test('T-JOURNAL M10 cancelled cash-out resumes the same prepared request from History without broadcasting', async ({
  browser,
  baseURL,
}) => {
  const session = z
    .object({ password: z.string() })
    .strict()
    .parse(JSON.parse(readFileSync('../../.accounts/m9-browser/signup-session.json', 'utf8')) as unknown);
  const context = await browser.newContext(),
    monitor = m9Privacy(context, [session.password]);
  await monitor.start();
  let blockedBroadcasts = 0;
  await context.route('**/*', async (route) => {
    if (/eth_sendRawTransaction|eth_sendTransaction|broadcast_tx/.test(route.request().postData() ?? '')) {
      blockedBroadcasts++;
      await route.abort();
    } else await route.fallback();
  });
  const page = await context.newPage();
  await page.goto('/app?view=account');
  await page.getByLabel('Passphrase', { exact: true }).fill(session.password);
  await page
    .getByLabel('Restore encrypted backup', { exact: true })
    .setInputFiles('../../.accounts/m9-browser/signup-backup.json');
  await m9Download(page, '../../.accounts/m10-browser/cashout-readback-backup.json');
  await m9Navigate(page, 'Wallet');
  const confirmations: string[] = [];
  await page.addLocatorHandler(
    page.getByRole('dialog', { name: 'Open a transaction window', exact: true }),
    async (modal) => {
      confirmations.push(await modal.locator('p').innerText());
      await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
    },
  );
  await page.getByRole('button', { name: 'Cash out', exact: true }).click();
  await expect(page.locator('.workflow')).toHaveAttribute('aria-busy', 'false', { timeout: 180000 });
  const original = (await m9Snapshot(page)).operations.filter((operation) => operation.id.startsWith('cashout-'));
  expect(original).toHaveLength(1);
  expect(original[0]).toMatchObject({ stage: 'PROVED', hash: null });
  await m9Navigate(page, 'Pay');
  await m9Navigate(page, 'Wallet');
  await page.getByText(/^History \(/).click();
  await expect(page.getByRole('button', { name: 'Cash out', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Resume prepared transaction', exact: true }).click();
  await expect(page.locator('.workflow')).toHaveAttribute('aria-busy', 'false', { timeout: 180000 });
  const resumed = (await m9Snapshot(page)).operations.filter((operation) => operation.id.startsWith('cashout-'));
  expect(resumed).toEqual(original);
  expect(confirmations).toHaveLength(2);
  expect(
    confirmations.every((value) => value.startsWith('This needs a transaction window: about 1 transaction,')),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  const fits390 = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  expect(fits390).toBe(true);
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  await page.waitForLoadState('networkidle');
  const network = await monitor.finish();
  const status =
    blockedBroadcasts ||
    network.leaks ||
    network.errors.length ||
    network.pendingInspections ||
    network.requests !== network.responses ||
    audit.violations.length
      ? 'FAILED'
      : 'PASSED';
  writeFileSync(
    '../../evidence/m10-cashout-retry.json',
    JSON.stringify(
      {
        command: 'pnpm evidence --m10-cashout-retry',
        origin: baseURL,
        status,
        blockedBroadcasts,
        confirmations,
        preparedOperationCount: resumed.length,
        originalRequestReused: true,
        fits390,
        network,
        axeViolations: audit.violations.map(({ id, impact }) => ({ id, impact })),
      },
      null,
      2,
    ) + '\n',
  );
  await context.close();
  expect(status).toBe('PASSED');
});
