import { expect, type Page } from '@playwright/test';
import type { publicSnapshot } from '../src/privacy.js';
export async function m9Snapshot(page: Page): Promise<ReturnType<typeof publicSnapshot>> {
  return page.evaluate(() => {
    if (!window.quaestorM6) throw new Error('VAULT_LOCKED');
    return window.quaestorM6.snapshot();
  });
}
export async function m9Navigate(page: Page, name: string) {
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
}
export async function m9Action(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.locator('.workflow')).toHaveAttribute('aria-busy', 'false', { timeout: 600000 });
  if (await page.getByTestId('workflow-error').isVisible()) throw new Error('UI_OPERATION_FAILED');
}
export async function m9Download(page: Page, target: string) {
  await expect(page.getByRole('button', { name: 'Download backup', exact: true })).toBeEnabled({ timeout: 60000 });
  const result = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  await (await result).saveAs(target);
  await page.waitForFunction(() => !!window.quaestorM6, {}, { timeout: 60000 });
}
export async function m9ActivationReceipts(page: Page) {
  return page.getByTestId('activation-receipt').evaluateAll((elements) =>
    elements.map((element) => ({
      hash: element.getAttribute('data-hash'),
      block: element.getAttribute('data-block'),
      step: element.getAttribute('data-step'),
    })),
  );
}
export async function m9SaveBackup(page: Page, target: string, password: string) {
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page.getByLabel('Backup passphrase', { exact: true }).fill(password);
  await m9Download(page, target);
}
