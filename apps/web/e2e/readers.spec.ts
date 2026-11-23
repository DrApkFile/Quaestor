import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { deriveUnifiedAccount } from '@qorechain/sdk';
import { deriveSealKeys } from '@qorechain/qoreseal';
import { decryptVault } from '../src/vault.js';
import { z } from 'zod';
test('T-NOPLAIN-M5 Public check and Auditor read the live M4 book without leaking plaintext', async ({ page }) => {
  const path = z.string().min(1).parse(process.env.QUAESTOR_AUDITOR_BACKUP);
  const password = z.string().min(12).parse(process.env.QUAESTOR_AUDITOR_PASSWORD);
  const payload = await decryptVault(JSON.parse(readFileSync(path, 'utf8')) as unknown, password);
  const account = await deriveUnifiedAccount(payload.mnemonic, 0);
  const keys = deriveSealKeys({ mnemonic: payload.mnemonic, index: 0 });
  const canaries = [
    payload.mnemonic,
    password,
    account.privateKey,
    Buffer.from(account.pqc.secretKey).toString('hex'),
    Buffer.from(keys.mlkemSecretKey).toString('hex'),
  ].filter((value) => value.length > 20);
  const leaks: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.name));
  await page.route('**/*', async (route) => {
    const request = route.request();
    const data = request.url() + (request.postData() ?? '') + JSON.stringify(await request.allHeaders());
    if (
      canaries.some((value) => data.includes(value) || data.includes(encodeURIComponent(value))) ||
      /"(?:counterparty|openingBalance|mnemonic|secretKey|privateKey|secret)"\s*:/.test(request.postData() ?? '')
    ) {
      leaks.push('PRIVATE_MATERIAL');
      await route.abort();
    } else await route.continue();
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const response = await page.goto('/app?view=public');
  expect(response?.headers()['content-security-policy']).toContain("'wasm-unsafe-eval'");
  await page.getByRole('button', { name: 'Check chain', exact: true }).click();
  await expect(page.getByText('anchored entries', { exact: true })).toBeVisible({ timeout: 180000 });
  await expect(page.getByText('VERIFIED', { exact: true })).toHaveCount(9);
  await page.screenshot({ path: '../../docs/screenshots/M5-public-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '../../docs/screenshots/M5-public-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Auditor', exact: true }).click();
  await page.getByText('Use your own auditor backup', { exact: true }).click();
  await page.getByLabel('Encrypted backup file', { exact: true }).setInputFiles(path);
  await page.getByLabel('Backup passphrase', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Open granted period', exact: true }).click();
  await expect(page.getByTestId('entry-verdict')).toHaveCount(3, { timeout: 240000 });
  for (const row of await page.getByTestId('entry-verdict').all())
    await expect(row).toHaveAttribute('data-code', 'MATCHED');
  await expect(page.getByTestId('period-verdict')).toHaveAttribute('data-code', 'HOLDINGS_COVER_BOOKS');
  await expect(page.locator('[data-code=NOT_GRANTED]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '../../docs/screenshots/M5-auditor-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: '../../docs/screenshots/M5-auditor-desktop.png', fullPage: true });
  expect(await page.evaluate(async () => (await (await caches.open('quaestor-circuits-v1')).keys()).length)).toBe(2);
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  const freshPassword = `${password}-new`;
  canaries.push(freshPassword);
  await page.getByLabel('Passphrase', { exact: true }).fill(freshPassword);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download encrypted backup', exact: true })).toBeVisible({
    timeout: 60000,
  });
  await expect(page.getByRole('button', { name: 'Register signing key', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Register encryption key', exact: true })).toBeDisabled();
  const freshDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download encrypted backup', exact: true }).click();
  const freshPath = await (await freshDownload).path();
  if (!freshPath) throw new Error('BACKUP_DOWNLOAD_MISSING');
  const fresh = await decryptVault(JSON.parse(readFileSync(freshPath, 'utf8')) as unknown, freshPassword);
  const freshAccount = await deriveUnifiedAccount(fresh.mnemonic, 0);
  await expect(page.getByText(freshAccount.cosmos, { exact: true })).toBeVisible();
  canaries.push(fresh.mnemonic, freshAccount.privateKey);
  await page.getByRole('button', { name: 'Lock account', exact: true }).click();
  await page.getByLabel('Passphrase', { exact: true }).fill(password);
  await page.getByLabel('Restore encrypted backup', { exact: true }).setInputFiles(path);
  await expect(page.getByText(account.cosmos, { exact: true })).toBeVisible({ timeout: 60000 });
  await expect(page.getByText('Ready for private payments', { exact: true })).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole('heading', { name: 'Set up your account.', exact: true })).toBeVisible();
  const restoredDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download encrypted backup', exact: true }).click();
  await restoredDownload;
  await expect(page.getByRole('heading', { name: 'Account ready.', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '../../docs/screenshots/M5-account-mobile.png', fullPage: true });
  expect(leaks).toEqual([]);
  expect(errors).toEqual([]);
});
