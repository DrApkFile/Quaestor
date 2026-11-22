import { expect, type Page, type BrowserContext } from '@playwright/test';
import { existsSync } from 'node:fs';
import { demoEntry } from './m8Entries.js';
import { fixture, folder, roleFixture } from './m6Fixtures.js';
import type { publicSnapshot } from '../src/privacy.js';
export async function snapshot(page: Page): Promise<ReturnType<typeof publicSnapshot>> {
  return page.evaluate(() => {
    if (!window.quaestorM6) throw new Error('VAULT_LOCKED');
    return window.quaestorM6.snapshot();
  });
}
export async function checkpoint(context: BrowserContext, name: string) {
  await context.storageState({ path: `${folder}/${name}-state.json`, indexedDB: true });
}
export const storage = (name: string) =>
  existsSync(`${folder}/${name}-state.json`) ? { storageState: `${folder}/${name}-state.json` } : {};
export async function unlock(page: Page, name: string) {
  const role = roleFixture(name);
  await page.goto('/app?view=account');
  const pass = page.getByLabel('Passphrase', { exact: true });
  await expect(pass).toBeVisible({ timeout: 60000 });
  await pass.fill(fixture.password);
  await page.getByLabel('Restore encrypted backup', { exact: true }).setInputFiles(role.backup);
  await expect(page.getByRole('button', { name: 'Download backup', exact: true })).toBeEnabled({
    timeout: 60000,
  });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  await download;
  await page.waitForFunction(() => !!window.quaestorM6, {}, { timeout: 60000 });
  await expect(page.getByText('Verified card found on BlobBoard.', { exact: true })).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole('button', { name: 'Refresh chain state', exact: true })).toBeEnabled({ timeout: 60000 });
  if (
    (await snapshot(page)).operations.some((value) => value.stage === 'BROADCAST' || value.stage === 'OUTCOME_UNKNOWN')
  ) {
    await navigate(page, 'Wallet');
    await action(page, () =>
      page.getByRole('button', { name: 'Resolve held transactions by hash', exact: true }).click(),
    );
  }
}
export async function navigate(page: Page, name: string) {
  console.log(`M6 navigate ${name}`);
  await page.bringToFront();
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click({ timeout: 30000 });
}
export async function action(page: Page, work: () => Promise<unknown>) {
  console.log('M6 action start');
  await work();
  console.log('M6 action clicked');
  await page.waitForTimeout(150);
  await expect(page.locator('.workflow')).toHaveAttribute('aria-busy', 'false', { timeout: 600000 });
  const alert = page.getByTestId('workflow-error');
  if (await alert.isVisible())
    throw new Error(
      `WORKFLOW_REJECTED: ${(await alert.textContent()) ?? 'REQUEST_FAILED'} · ${(await page.evaluate(() => Reflect.get(window, 'quaestorLastError') as string | undefined)) ?? 'No diagnostic'}`,
    );
}
export async function prepare(page: Page) {
  await navigate(page, 'Wallet');
  await action(page, () => page.getByRole('button', { name: 'Prepare to transact', exact: true }).click());
}
export async function shield(page: Page, amount: string) {
  if ((await snapshot(page)).transactions.some((tx) => tx.id.startsWith('deposit-'))) return;
  await prepare(page);
  await page.getByLabel('Deposit amount', { exact: true }).fill(amount);
  await action(page, () => page.getByRole('button', { name: 'Deposit privately', exact: true }).click());
}
export async function send(page: Page, to: string, amount: string, count: number) {
  const current = await snapshot(page);
  if (current.payments.filter((value) => value.direction === 'OUT' && value.stage !== 'SENT').length >= count) return;
  await navigate(page, 'Pay');
  const resume = page.getByRole('button', { name: 'Resume existing payment', exact: true });
  if (await resume.count()) {
    await action(page, () => resume.first().click());
    return;
  }
  await page.getByLabel('Recipient qor1 address', { exact: true }).fill(to);
  await page.getByLabel('Payment amount', { exact: true }).fill(amount);
  await action(page, () => page.getByRole('button', { name: 'Prove and pay', exact: true }).click());
}
export async function scan(page: Page) {
  await navigate(page, 'Receive');
  await action(page, () => page.getByRole('button', { name: 'Scan memo board', exact: true }).click());
}
export async function bookEntries(page: Page) {
  await navigate(page, 'Books');
  while (await page.getByRole('button', { name: 'Prove receipt and save entry', exact: true }).count()) {
    const form = page.getByRole('button', { name: 'Prove receipt and save entry', exact: true }).first().locator('..');
    const current = (await snapshot(page)).books.at(-1);
    const index = current?.periods.reduce((sum, period) => sum + period.count, 0) ?? 0;
    const entry = fixture.publicDemo ? demoEntry(index) : undefined;
    await form.getByLabel('Counterparty name', { exact: true }).fill(entry?.name ?? fixture.canaries[0] ?? '');
    await form.getByLabel('Purpose', { exact: true }).fill(entry?.purpose ?? fixture.canaries[1] ?? '');
    await form
      .getByLabel('Notes', { exact: true })
      .fill(entry ? 'Fictional testnet demonstration.' : (fixture.canaries[2] ?? ''));
    if (entry) await form.getByLabel('Category', { exact: true }).fill(entry.category);
    if (!entry)
      await form
        .getByLabel('Invoice attachment (optional, max 20 KB)', { exact: true })
        .setInputFiles({ name: 'invoice.txt', mimeType: 'text/plain', buffer: Buffer.from(fixture.canaries[3] ?? '') });
    await action(page, () => form.getByRole('button', { name: 'Prove receipt and save entry', exact: true }).click());
  }
}
export async function screenshots(page: Page, name: string) {
  if (name === 'wallet') await expect(page.getByText(/^Pinned balance block: \d+/)).toBeVisible({ timeout: 60000 });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    if (!fits)
      console.log(
        await page.evaluate(() =>
          Array.from(document.querySelectorAll('*'))
            .filter((element) => element.getBoundingClientRect().right > innerWidth)
            .map((element) => ({
              tag: element.tagName,
              class: element.className,
              width: element.getBoundingClientRect().width,
            })),
        ),
      );
    expect(fits).toBe(true);
    await page.screenshot({ path: `../../evidence/m6-screens/${name}-${String(width)}.png`, fullPage: true });
  }
}

export async function freshScan(page: Page) {
  await navigate(page, 'Receive');
  const button = page.getByRole('button', { name: 'Start at current block (fresh demo)', exact: true });
  if (await button.count()) await action(page, () => button.click());
}
