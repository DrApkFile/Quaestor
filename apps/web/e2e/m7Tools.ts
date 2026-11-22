import { expect, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { folder, fixture, roleFixture } from './m6Fixtures.js';
import { snapshot, navigate, action, prepare, send, scan, bookEntries } from './m6Driver.js';
export async function payment(payer: Page, payee: Page, role: string, amount: string, count: number, bookOwner?: Page) {
  if ((await snapshot(payer)).payments.filter((value) => value.direction === 'OUT').length < count)
    await prepare(payer);
  await send(payer, roleFixture(role).address, amount, count);
  await scan(payee);
  if (bookOwner) {
    await prepare(bookOwner);
    await bookEntries(bookOwner);
  }
}
export async function grant(page: Page, who: string, period: string, bookId: string) {
  const txs = (await snapshot(page)).transactions;
  if (
    txs.some(
      (tx) =>
        tx.id.startsWith('grant-') &&
        tx.id.includes(bookId.slice(2)) &&
        tx.id.includes(period) &&
        tx.id.includes(roleFixture(who).address) &&
        tx.id.endsWith('-anchor'),
    )
  )
    return;
  await prepare(page);
  await navigate(page, 'Grants');
  await page.getByLabel('Grant period', { exact: true }).selectOption(period);
  await page.getByLabel('Auditor qor1 address', { exact: true }).fill(roleFixture(who).address);
  await page.getByLabel('I understand this grant is permanent', { exact: true }).check();
  await action(page, () => page.getByRole('button', { name: 'Verify card and grant period', exact: true }).click());
}
export async function close(page: Page, bookId: string, ordinal: number) {
  if ((await snapshot(page)).books.find((b) => b.id === bookId)?.periods[ordinal]?.closed) return;
  await prepare(page);
  await navigate(page, 'Books');
  await action(page, () => page.getByRole('button', { name: 'Build holdings proof and close', exact: true }).click());
}
export async function next(page: Page, bookId: string, count: number) {
  if (((await snapshot(page)).books.find((b) => b.id === bookId)?.periods.length ?? 0) >= count) return;
  await prepare(page);
  await navigate(page, 'Books');
  await action(page, () =>
    page.getByRole('button', { name: 'Open next Daily (demo-scale) period', exact: true }).click(),
  );
}
export async function audit(
  page: Page,
  bookId: string,
  role: string,
  matches: number,
  backup?: { file: string; passphrase: string },
) {
  await page.goto('/app?view=auditor');
  await page.getByLabel('Audit book ID', { exact: true }).fill(bookId);
  await page
    .getByLabel('Encrypted backup file', { exact: true })
    .setInputFiles(backup?.file ?? roleFixture(role).backup);
  await page.getByLabel('Backup passphrase', { exact: true }).fill(backup?.passphrase ?? fixture.password);
  await page.getByRole('button', { name: 'Open granted period', exact: true }).click();
  await expect(page.getByTestId('entry-verdict')).toHaveCount(matches, { timeout: 300000 });
  for (const row of await page.getByTestId('entry-verdict').all()) await expect(row).toHaveText('MATCHED');
  for (const row of await page.getByTestId('period-verdict').all())
    await expect(row).toHaveText('HOLDINGS_COVER_BOOKS');
  await expect(page.getByText('NOT_GRANTED', { exact: true })).toHaveCount(role === 'client' ? 2 : 1);
  await expect(page.getByText('opening balance as declared and signed by the business', { exact: true })).toBeVisible();
}
export async function shots(page: Page, name: string) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (fixture.publicDemo) {
      const containsSecret = await page.evaluate(() => window.quaestorPrivateCheck?.(document.body.innerText) ?? false);
      expect(containsSecret).toBe(false);
      writeFileSync(`${folder}/${name}-${String(width)}-visible.txt`, await page.locator('body').innerText());
    }
    await page.screenshot({
      path: `../../evidence/${process.env.QUAESTOR_DEMO_RUN ?? 'm7'}-screens/${name}-${String(width)}.png`,
      fullPage: true,
      mask: fixture.publicDemo
        ? []
        : [page.locator('[data-private-ledger]:visible'), page.locator('input[type=password]:visible')],
    });
  }
}
export function step(value: string) {
  writeFileSync(`${folder}/stage.txt`, value);
  console.log(`M7 ${value}`);
}
