import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { m9Privacy } from './m9Privacy.js';
import { m9Screens } from './m9Screens.js';
import { m9Download, m9Navigate } from './m9Driver.js';
test('A12 M9 measured setup fees and the 1.5 QOR private change restore without a transaction', async ({
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
  const screens = await m9Screens(page, 'after', 'signup-account-estimate');
  await m9Navigate(page, 'Wallet');
  await expect(page.locator('.stats article').first().locator('strong')).toHaveText('1.5 QOR');
  screens.push(...(await m9Screens(page, 'after', 'signup-restored-wallet')));
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
  writeFileSync(
    '../../evidence/m9-readback.json',
    JSON.stringify(
      {
        command: 'pnpm evidence --m9-wallet-readback',
        origin: baseURL,
        at: new Date().toISOString(),
        status,
        estimatedSetupQor: estimate.estimatedSetupQor,
        privateBalanceQor: '1.5',
        transactionRequests: mutations,
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
