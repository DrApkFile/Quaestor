import { expect, type Page } from '@playwright/test';
import { m10Screens } from './m10Screens.js';
export async function m10CancelWindow(page: Page, run: 'm10' | 'm10b') {
  await page.getByRole('button', { name: 'Deposit privately', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Open a transaction window', exact: true });
  await expect(modal).toBeVisible({ timeout: 180000 });
  const cancel = modal.getByRole('button', { name: 'Cancel', exact: true });
  const accept = modal.getByRole('button', { name: 'Open window and continue', exact: true });
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(accept).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(accept).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(cancel).toBeFocused();
  const confirmation = await modal.locator('p').textContent();
  expect(confirmation).toMatch(
    /^This needs a transaction window: about 1 transaction, up to [\d.]+ QOR including fees\.$/,
  );
  await expect(page.getByTestId('proof-progress')).not.toContainText(/\w+ proved/);
  const screens = await m10Screens(page, 'after', 'window-modal', run);
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(page.locator('.workflow')).toHaveAttribute('aria-busy', 'false', { timeout: 30000 });
  await expect(page.getByTestId('workflow-error')).toHaveText('Cancelled. Nothing was sent.');
  await expect(page.getByTestId('workflow-error')).toHaveAttribute('role', 'status');
  await expect(page.getByTestId('workflow-error').getByRole('button')).toHaveCount(0);
  screens.push(...(await m10Screens(page, 'after', 'window-cancelled', run)));
  await page.getByRole('button', { name: 'Deposit privately', exact: true }).click();
  await expect(modal).toBeVisible({ timeout: 30000 });
  await cancel.click();
  await expect(modal).toHaveCount(0);
  await expect(page.locator('.workflow')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByTestId('workflow-error')).toHaveText('Cancelled. Nothing was sent.');
  return { confirmation, screens };
}
