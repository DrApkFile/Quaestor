import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { z } from 'zod';
import { m9Privacy } from './m9Privacy.js';
import { m10Screens as m9Screens } from './m10Screens.js';
import { m9Download, m9Navigate, m9SaveBackup } from './m9Driver.js';
test('T-NOPLAIN-WEB M10 measured setup fees and the 1.5 QOR private change restore without a transaction', async ({
  browser,
  baseURL,
}) => {
  const session = z
    .object({ password: z.string() })
    .strict()
    .parse(JSON.parse(readFileSync('../../.accounts/m9-browser/signup-session.json', 'utf8')) as unknown);
  const estimate = z
    .object({ estimatedSetupQor: z.string() })
    .passthrough()
    .parse(JSON.parse(readFileSync('public/activation-estimate.json', 'utf8')) as unknown);
  const context = await browser.newContext(),
    monitor = m9Privacy(context, [session.password]);
  await monitor.start();
  let mutations = 0;
  context.on('request', (request) => {
    if (/eth_sendRawTransaction|eth_sendTransaction|broadcast_tx/.test(request.postData() ?? '')) mutations++;
  });
  const page = await context.newPage();
  await page.goto('/app?view=account');
  await page.getByLabel('Passphrase', { exact: true }).fill(session.password);
  await page
    .getByLabel('Restore encrypted backup', { exact: true })
    .setInputFiles('../../.accounts/m9-browser/signup-backup.json');
  await m9Download(page, '../../.accounts/m9-browser/readback-backup.json');
  await expect(page.getByTestId('activation-estimate')).toContainText(`${estimate.estimatedSetupQor} QOR`);
  const screens = await m9Screens(page, process.env.QUAESTOR_M10_PHASE ?? 'before', 'signup-account-estimate');
  await m9Navigate(page, 'Wallet');
  await expect(page.locator('.stats article').first().locator('strong')).toHaveText('1.5 QOR');
  screens.push(...(await m9Screens(page, process.env.QUAESTOR_M10_PHASE ?? 'before', 'signup-restored-wallet')));
  for (const view of ['Pay', 'Books', 'Grants']) {
    await m9Navigate(page, view);
    screens.push(...(await m9Screens(page, process.env.QUAESTOR_M10_PHASE ?? 'before', view.toLowerCase())));
  }
  let windowConfirmation: string | null = null;
  if (process.env.QUAESTOR_M10_PHASE === 'after') {
    await m9Navigate(page, 'Wallet');
    await page.getByText(/^History \(/).click();
    await page
      .locator('details.panel > summary')
      .filter({ hasText: /^Details$/ })
      .click();
    await page.getByText('Advanced: transaction window', { exact: true }).click();
    screens.push(...(await m9Screens(page, 'after', 'wallet-history-details')));
    let confirmation = '';
    page.once('dialog', (dialog) => {
      confirmation = dialog.message();
      void dialog.dismiss();
    });
    await page.getByRole('button', { name: 'Deposit privately', exact: true }).click();
    await expect(page.locator('.workflow')).toHaveAttribute('aria-busy', 'false', { timeout: 180000 });
    expect(confirmation).toMatch(
      /^This needs a transaction window: about 1 transactions, up to [\d.]+ QOR including fees$/,
    );
    windowConfirmation = confirmation;
    await expect(page.getByTestId('workflow-error')).toBeVisible();
    screens.push(...(await m9Screens(page, 'after', 'window-cancelled')));
    await m9SaveBackup(page, '../../.accounts/m10-browser/readback-backup.json', session.password);
  }
  await page.waitForLoadState('networkidle');
  const network = await monitor.finish();
  const status =
    mutations ||
    network.leaks ||
    network.errors.length ||
    network.pendingInspections ||
    network.requests !== network.responses ||
    screens.some(
      (screen) => !screen.fits || screen.violations.some((value) => ['serious', 'critical'].includes(value.impact)),
    )
      ? 'FAILED'
      : 'PASSED';
  const target = `../../evidence/m10-readback-${process.env.QUAESTOR_M10_PHASE ?? 'before'}.json`;
  if (existsSync(target)) copyFileSync(target, target.replace('.json', `-attempt-${String(Date.now())}.json`));
  writeFileSync(
    target,
    JSON.stringify(
      {
        command: 'pnpm evidence --m10-screens',
        origin: baseURL,
        at: new Date().toISOString(),
        status,
        estimatedSetupQor: estimate.estimatedSetupQor,
        privateBalanceQor: '1.5',
        transactionRequests: mutations,
        cancelledWindowConfirmation: windowConfirmation,
        network,
        screens,
      },
      null,
      2,
    ) + '\n',
  );
  await context.close();
  expect(status).toBe('PASSED');
});

test('T-NOPLAIN-WEB M10 populated business notes and books remain private at both widths', async ({
  browser,
  baseURL,
}) => {
  const { m9Fixtures } = await import('./m9Fixtures.js');
  const fixture = m9Fixtures(),
    business = fixture.roles.business;
  if (!business) throw new Error('BUSINESS_FIXTURE_REQUIRED');
  const context = await browser.newContext(),
    monitor = m9Privacy(context, [fixture.password]);
  await monitor.start();
  let mutations = 0;
  context.on('request', (request) => {
    if (/eth_sendRawTransaction|eth_sendTransaction|broadcast_tx/.test(request.postData() ?? '')) mutations++;
  });
  const page = await context.newPage();
  await page.goto('/app?view=account');
  await page.getByLabel('Passphrase', { exact: true }).fill(fixture.password);
  await page.getByLabel('Restore encrypted backup', { exact: true }).setInputFiles(business.backup);
  await m9Download(page, '../../.accounts/m10-browser/business-readback-backup.json');
  const screens = [];
  const phase = process.env.QUAESTOR_M10_PHASE ?? 'before';
  for (const view of ['Wallet', 'Pay', 'Books', 'Grants']) {
    await m9Navigate(page, view);
    screens.push(...(await m9Screens(page, phase, `business-${view.toLowerCase()}`)));
    if (view === 'Wallet' && phase === 'after') {
      const history = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: /^History/ }) });
      await history.locator(':scope > summary').click();
      await expect(history.getByRole('button', { name: 'Cash out', exact: true })).toHaveCount(0);
      screens.push(...(await m9Screens(page, phase, 'business-wallet-history')));
    }
  }
  await page.waitForLoadState('networkidle');
  const network = await monitor.finish();
  const status =
    mutations ||
    network.leaks ||
    network.errors.length ||
    network.pendingInspections ||
    network.requests !== network.responses ||
    screens.some((screen) => !screen.fits || screen.violations.length)
      ? 'FAILED'
      : 'PASSED';
  const target = `../../evidence/m10-business-${phase}.json`;
  if (existsSync(target)) copyFileSync(target, target.replace('.json', `-attempt-${String(Date.now())}.json`));
  writeFileSync(
    target,
    JSON.stringify(
      { command: 'pnpm evidence --m10-screens', origin: baseURL, status, mutations, network, screens },
      null,
      2,
    ) + '\n',
  );
  await context.close();
  expect(status).toBe('PASSED');
});
