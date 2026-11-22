import { expect, type Page, type Browser, type BrowserContext } from '@playwright/test';
import { fixture, folder } from './m6Fixtures.js';
import { privacyMonitor } from './m6Privacy.js';
import { navigate, snapshot } from './m6Driver.js';
import { shots } from './m7Tools.js';
export async function restoreCompleteBackup(
  b: Page,
  browser: Browser,
  contexts: BrowserContext[],
  monitors: ReturnType<typeof privacyMonitor>[],
) {
  await navigate(b, 'Wallet');
  await expect(b.getByText(/^Pinned balance block: \d+/)).toBeVisible({ timeout: 60000 });
  const balance = await b.locator('.stats strong').first().textContent();
  await b.getByRole('button', { name: 'Account', exact: true }).click();
  await b.getByLabel('Backup passphrase', { exact: true }).fill(fixture.password);
  const download = b.waitForEvent('download');
  await b.getByRole('button', { name: 'Download backup', exact: true }).click();
  const complete = `${folder}/business-complete.json`;
  await (await download).saveAs(complete);
  await expect(b.getByRole('button', { name: 'Refresh chain state', exact: true })).toBeEnabled({ timeout: 60000 });
  const restored = await browser.newContext();
  contexts.push(restored);
  const restoreMonitor = privacyMonitor(restored);
  monitors.push(restoreMonitor);
  await restoreMonitor.start();
  const r = await restored.newPage();
  await r.goto('/app');
  await r.getByLabel('Passphrase', { exact: true }).fill(fixture.password);
  await r.getByLabel('Restore encrypted backup', { exact: true }).setInputFiles(complete);
  await expect(r.getByRole('button', { name: 'Download backup', exact: true })).toBeEnabled({ timeout: 60000 });
  const restoredDownload = r.waitForEvent('download');
  await r.getByRole('button', { name: 'Download backup', exact: true }).click();
  await restoredDownload;
  await r.waitForFunction(() => !!window.quaestorM6, {}, { timeout: 60000 });
  await navigate(r, 'Wallet');
  await expect(r.getByText(/^Pinned balance block: \d+/)).toBeVisible({ timeout: 60000 });
  await expect(r.locator('.stats strong').first()).toHaveText(balance ?? 'BALANCE_MISSING');
  expect((await snapshot(r)).payments.length).toBe((await snapshot(b)).payments.length);
  await shots(r, 'restored-wallet');
}
