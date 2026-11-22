import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { fixture, folder, roleFixture } from './m6Fixtures.js';
import {
  unlock,
  navigate,
  action,
  shield,
  send,
  scan,
  bookEntries,
  snapshot,
  checkpoint,
  storage,
  prepare,
  screenshots,
  freshScan,
} from './m6Driver.js';
import { privacyMonitor } from './m6Privacy.js';
test('T-NOPLAIN-WEB M6 real anonymous payments, sealed entries, close and scoped browser audit', async ({
  browser,
}) => {
  test.setTimeout(1800000);
  const client = await browser.newContext(storage('client')),
    business = await browser.newContext(storage('business')),
    other = await browser.newContext(storage('other'));
  const monitors = [client, business, other].map((context) => privacyMonitor(context));
  for (const monitor of monitors) await monitor.start();
  const c = await client.newPage(),
    b = await business.newPage(),
    o = await other.newPage();
  let stage = 'START';
  const step = (value: string) => {
    stage = value;
    writeFileSync(`${folder}/stage.txt`, value);
    console.log(`M6 ${value}`);
  };
  try {
    step('LANDING');
    await o.goto('/');
    await screenshots(o, 'landing');
    step('UNLOCK');
    await unlock(c, 'client');
    await unlock(b, 'business');
    await checkpoint(client, 'client');
    await freshScan(b);
    await checkpoint(business, 'business');
    for (const role of ['supplier1', 'supplier2']) {
      await unlock(o, role);
      await freshScan(o);
      await checkpoint(other, 'other');
    }
    step('DEPOSITS');
    await shield(c, '3');
    await checkpoint(client, 'client');
    await shield(b, '2');
    await checkpoint(business, 'business');
    step('BOOK');
    let book = (await snapshot(b)).books[0];
    if (!book) {
      await prepare(b);
      await navigate(b, 'Books');
      await b.getByLabel('Book name', { exact: true }).fill(fixture.label);
      await b.getByLabel('Period length', { exact: true }).selectOption('Daily (demo-scale)');
      await action(b, () => b.getByRole('button', { name: 'Sign and create book', exact: true }).click());
      await checkpoint(business, 'business');
      book = (await snapshot(b)).books[0];
    }
    if (!book) throw new Error('BOOK_REQUIRED');
    const bookId = book.id;
    step('CLIENT_TO_BUSINESS');
    await prepare(c);
    await send(c, roleFixture('business').address, '1', 1);
    await checkpoint(client, 'client');
    await scan(b);
    await bookEntries(b);
    await checkpoint(business, 'business');
    step('BUSINESS_TO_SUPPLIER1');
    await prepare(b);
    await send(b, roleFixture('supplier1').address, '0.5', 1);
    await bookEntries(b);
    await checkpoint(business, 'business');
    await unlock(o, 'supplier1');
    await scan(o);
    await checkpoint(other, 'other');
    step('BUSINESS_TO_SUPPLIER2');
    await send(b, roleFixture('supplier2').address, '0.25', 2);
    await bookEntries(b);
    await checkpoint(business, 'business');
    await unlock(o, 'supplier2');
    await scan(o);
    await checkpoint(other, 'other');
    step('CLOSE_A');
    await navigate(b, 'Books');
    if (!(await snapshot(b)).books[0]?.periods[0]?.closed) {
      await action(b, () => b.getByRole('button', { name: 'Build holdings proof and close', exact: true }).click());
      await checkpoint(business, 'business');
    }
    step('GRANT_A');
    await navigate(b, 'Grants');
    const grants = (await snapshot(b)).transactions.filter(
      (tx) => tx.id.startsWith('grant-') && tx.id.includes(roleFixture('auditor').address) && tx.id.endsWith('-anchor'),
    );
    if (!grants.length) {
      await b.getByLabel('Auditor qor1 address', { exact: true }).fill(roleFixture('auditor').address);
      await b.getByLabel('I understand this grant is permanent', { exact: true }).check();
      await action(b, () => b.getByRole('button', { name: 'Verify card and grant period', exact: true }).click());
      await checkpoint(business, 'business');
    }
    step('PERIOD_B');
    await navigate(b, 'Books');
    if ((await snapshot(b)).books[0]?.periods.length === 1) {
      await action(b, () =>
        b.getByRole('button', { name: 'Open next Daily (demo-scale) period', exact: true }).click(),
      );
      await checkpoint(business, 'business');
    }
    await prepare(c);
    await send(c, roleFixture('business').address, '0.01', 2);
    await checkpoint(client, 'client');
    await scan(b);
    await bookEntries(b);
    await checkpoint(business, 'business');
    step('AUDITOR');
    await o.goto('/app?view=auditor');
    await o.getByLabel('Audit book ID', { exact: true }).fill(bookId);
    await o.getByLabel('Encrypted backup file', { exact: true }).setInputFiles(roleFixture('auditor').backup);
    await o.getByLabel('Backup passphrase', { exact: true }).fill(fixture.password);
    await o.getByRole('button', { name: 'Open granted period', exact: true }).click();
    await expect(o.getByTestId('entry-verdict')).toHaveCount(3, { timeout: 240000 });
    for (const verdict of await o.getByTestId('entry-verdict').all()) await expect(verdict).toHaveText('MATCHED');
    await expect(o.getByTestId('period-verdict')).toHaveText('HOLDINGS_COVER_BOOKS');
    await expect(o.getByText('NOT_GRANTED', { exact: true })).toBeVisible();
    await screenshots(o, 'auditor');
    step('SCREENSHOTS');
    for (const view of ['Wallet', 'Pay', 'Receive', 'Books', 'Grants']) {
      await navigate(b, view);
      await screenshots(b, view.toLowerCase());
    }
    await navigate(b, 'Public check');
    await b.getByLabel('Book ID (demo)', { exact: true }).fill(bookId);
    await b.getByRole('button', { name: 'Check chain', exact: true }).click();
    await expect(b.getByText('anchored entries', { exact: true })).toBeVisible({ timeout: 120000 });
    await screenshots(b, 'public');
    await b.getByRole('button', { name: 'Account', exact: true }).click();
    await screenshots(b, 'account');
    const network = [];
    for (const monitor of monitors) network.push(await monitor.finish());
    expect(network.every((value) => value.leaks === 0 && value.errors.length === 0)).toBe(true);
    const evidence = {
      command: 'pnpm evidence --m6',
      at: new Date().toISOString(),
      status: 'PASSED',
      bookId,
      contextCount: 3,
      periodLength: 'Daily (demo-scale)',
      client: await snapshot(c),
      business: await snapshot(b),
      auditor: { entries: ['MATCHED', 'MATCHED', 'MATCHED'], periodA: 'HOLDINGS_COVER_BOOKS', periodB: 'NOT_GRANTED' },
      network,
      screenshots: 'evidence/m6-screens/',
      canaries: ['counterparty', 'purpose', 'notes', 'invoice'],
      secretsCheckedInsideBrowser: ['mnemonic', 'private keys', 'seal secret keys', 'note secrets'],
      notEstablished: [
        'compromised browsers or extensions',
        'unexercised flows',
        'Groth16 soundness',
        'metadata privacy',
      ],
    };
    writeFileSync('../../evidence/m6-browser.json', JSON.stringify(evidence, null, 2) + '\n');
    step('PASSED');
  } catch (error: unknown) {
    writeFileSync(
      `../../evidence/m6-browser-attempt-${Date.now()}.json`,
      JSON.stringify(
        {
          command: 'pnpm evidence --m6',
          at: new Date().toISOString(),
          status: 'FAILED',
          stage,
          code: error instanceof Error ? error.name : 'FAILED',
        },
        null,
        2,
      ) + '\n',
    );
    throw error;
  } finally {
    await checkpoint(client, 'client');
    await checkpoint(business, 'business');
    await checkpoint(other, 'other');
    await client.close();
    await business.close();
    await other.close();
  }
});
