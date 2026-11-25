import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { z } from 'zod';
import { execFileSync } from 'node:child_process';
const commit = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
import { m9Privacy } from './m9Privacy.js';
import { m10Screens } from './m10Screens.js';
import { m10CancelWindow } from './m10WindowUI.js';
const run = process.env.QUAESTOR_M10_RUN === 'm10b' ? 'm10b' : 'm10';
const m9Screens: typeof m10Screens = (page, phase, view) => m10Screens(page, phase, view, run);
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
  await context.route('**/*', async (route) => {
    if (/eth_sendRawTransaction|eth_sendTransaction|broadcast_tx/.test(route.request().postData() ?? ''))
      await route.abort();
    else await route.fallback();
  });
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
  await expect(page.getByText(/^Pinned balance block:/)).toBeHidden();
  await expect(page.getByText('Advanced: transaction window', { exact: true })).toBeHidden();
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
    await expect(page.getByLabel('Planned operations', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Planned native QOR value', { exact: true })).toHaveValue('');
    screens.push(...(await m9Screens(page, 'after', 'wallet-history-details')));
    const cancelled = await m10CancelWindow(page, run);
    windowConfirmation = cancelled.confirmation;
    screens.push(...cancelled.screens);
    await m9SaveBackup(page, `../../.accounts/${run}-browser/readback-backup.json`, session.password);
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
  const target = `../../evidence/${run}-readback-${process.env.QUAESTOR_M10_PHASE ?? 'before'}.json`;
  if (existsSync(target)) copyFileSync(target, target.replace('.json', `-attempt-${String(Date.now())}.json`));
  writeFileSync(
    target,
    JSON.stringify(
      {
        command: `pnpm evidence --${run}-screens`,
        commit: commit(),
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
  await context.route('**/*', async (route) => {
    if (/eth_sendRawTransaction|eth_sendTransaction|broadcast_tx/.test(route.request().postData() ?? ''))
      await route.abort();
    else await route.fallback();
  });
  let mutations = 0;
  context.on('request', (request) => {
    if (/eth_sendRawTransaction|eth_sendTransaction|broadcast_tx/.test(request.postData() ?? '')) mutations++;
  });
  const page = await context.newPage();
  await page.goto('/app?view=account');
  await page.getByLabel('Passphrase', { exact: true }).fill(fixture.password);
  await page.getByLabel('Restore encrypted backup', { exact: true }).setInputFiles(business.backup);
  await m9Download(page, `../../.accounts/${run}-browser/business-readback-backup.json`);
  const screens = [];
  const phase = process.env.QUAESTOR_M10_PHASE ?? 'before';
  for (const view of ['Wallet', 'Pay', 'Books', 'Grants']) {
    await m9Navigate(page, view);
    screens.push(...(await m9Screens(page, phase, `business-${view.toLowerCase()}`)));
    if (view === 'Wallet' && phase === 'after') {
      const history = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: /^History/ }) });
      await history.locator(':scope > summary').click();
      await expect(history.getByRole('button', { name: 'Cash out', exact: true })).toHaveCount(0);
      const count = Number((await history.locator(':scope > summary').textContent())?.match(/\d+/)?.[0]);
      await expect(history.locator('tbody tr')).toHaveCount(Math.min(count, 10));
      await expect(history.getByText('Ready to spend', { exact: true })).toHaveCount(0);
      screens.push(...(await m9Screens(page, phase, 'business-wallet-history')));
      if (count > 10) {
        await history.getByRole('button', { name: `Show all (${String(count)})`, exact: true }).click();
        await expect(history.locator('tbody tr')).toHaveCount(count);
      }
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
  const target = `../../evidence/${run}-business-${phase}.json`;
  if (existsSync(target)) copyFileSync(target, target.replace('.json', `-attempt-${String(Date.now())}.json`));
  writeFileSync(
    target,
    JSON.stringify(
      {
        command: `pnpm evidence --${run}-screens`,
        commit: commit(),
        at: new Date().toISOString(),
        origin: baseURL,
        status,
        mutations,
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
