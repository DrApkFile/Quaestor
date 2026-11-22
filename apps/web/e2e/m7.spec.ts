import { test, expect } from '@playwright/test';
import { parseEther } from 'viem';
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { fixture, folder } from './m6Fixtures.js';
import { unlock, navigate, action, prepare, snapshot, checkpoint, storage, bookEntries } from './m6Driver.js';
import { privacyMonitor } from './m6Privacy.js';
import { restoreCompleteBackup } from './m7Backup.js';
import { payment, close, grant, next, audit, shots, step } from './m7Tools.js';
test('T-NOPLAIN-WEB daily A/B closed, C private, complete backup and B-only grant', async ({ browser }) => {
  test.setTimeout(3600000);
  const run = process.env.QUAESTOR_DEMO_RUN ?? 'm7';
  const plan = z
    .object({ client: z.number(), business: z.number(), oldBooks: z.array(z.string()) })
    .strict()
    .parse(JSON.parse(readFileSync(`${folder}/plan.json`, 'utf8')) as unknown);
  const client = await browser.newContext(storage('client')),
    business = await browser.newContext(storage('business')),
    other = await browser.newContext(storage('other'));
  const contexts = [client, business, other];
  const monitors = contexts.map(privacyMonitor);
  for (const monitor of monitors) await monitor.start();
  const openOther = async () => {
    await monitors[2]?.finish();
    for (const page of other.pages()) await page.close();
    return other.newPage();
  };
  const c = await client.newPage(),
    b = await business.newPage();
  let o = await openOther();
  try {
    step('UNLOCK');
    await unlock(c, 'client');
    await unlock(b, 'business');
    let book = (await snapshot(b)).books.find((value) => !plan.oldBooks.includes(value.id));
    if (!book) {
      await navigate(c, 'Wallet');
      if (parseEther(await c.locator('.stats strong').first().innerText()) < parseEther('1.11')) {
        await prepare(c);
        await c.getByLabel('Deposit amount', { exact: true }).fill('1');
        await action(c, () => c.getByRole('button', { name: 'Deposit privately', exact: true }).click());
        await checkpoint(client, 'client');
      }
      await prepare(b);
      await bookEntries(b);
      await checkpoint(business, 'business');
      await navigate(b, 'Books');
      await b.getByLabel('Book name', { exact: true }).fill(fixture.label);
      await b.getByLabel('Period length', { exact: true }).selectOption('Daily (demo-scale)');
      await action(b, () => b.getByRole('button', { name: 'Sign and create book', exact: true }).click());
      await checkpoint(business, 'business');
      book = (await snapshot(b)).books.find((value) => !plan.oldBooks.includes(value.id));
    }
    if (!book) throw new Error('BOOK_REQUIRED');
    const id = book.id,
      periodA = book.periods[0]?.id;
    if (!periodA) throw new Error('PERIOD_REQUIRED');
    step('A_IN');
    await payment(c, b, 'business', '1', plan.client + 1, b);
    await checkpoint(client, 'client');
    await checkpoint(business, 'business');
    step('A_OUT1');
    o = await openOther();
    await unlock(o, 'supplier1');
    await payment(b, o, 'supplier1', '0.5', plan.business + 1, b);
    await checkpoint(business, 'business');
    await checkpoint(other, 'other');
    step('A_OUT2');
    o = await openOther();
    await unlock(o, 'supplier2');
    await payment(b, o, 'supplier2', '0.25', plan.business + 2, b);
    await checkpoint(business, 'business');
    await checkpoint(other, 'other');
    step('A_CLOSE_GRANT');
    await close(b, id, 0);
    await grant(b, 'auditor', periodA, id);
    await checkpoint(business, 'business');
    step('B');
    await next(b, id, 2);
    await checkpoint(business, 'business');
    await payment(c, b, 'business', '0.1', plan.client + 2, b);
    await checkpoint(client, 'client');
    await checkpoint(business, 'business');
    o = await openOther();
    await unlock(o, 'supplier1');
    await payment(b, o, 'supplier1', '0.05', plan.business + 3, b);
    await checkpoint(business, 'business');
    await checkpoint(other, 'other');
    const periodB = (await snapshot(b)).books.find((value) => value.id === id)?.periods[1]?.id;
    if (!periodB) throw new Error('PERIOD_REQUIRED');
    await close(b, id, 1);
    await grant(b, 'auditor', periodB, id);
    await grant(b, 'client', periodB, id);
    await checkpoint(business, 'business');
    step('C');
    await next(b, id, 3);
    await checkpoint(business, 'business');
    await payment(c, b, 'business', '0.01', plan.client + 3, b);
    await checkpoint(client, 'client');
    await checkpoint(business, 'business');
    const periods = (await snapshot(b)).books.find((value) => value.id === id)?.periods;
    expect(periods?.map((value) => ({ closed: value.closed, count: value.count }))).toEqual([
      { closed: true, count: 3 },
      { closed: true, count: 2 },
      { closed: false, count: 1 },
    ]);
    step('AUDITOR');
    o = await openOther();
    await audit(o, id, 'auditor', 5);
    await expect(o.getByTestId('period-verdict')).toHaveCount(2);
    await expect(o.locator('.ledger-cells')).toHaveCount(5);
    await shots(o, 'auditor');
    step('B_ONLY');
    o = await openOther();
    await audit(o, id, 'client', 2);
    await expect(o.getByTestId('period-verdict')).toHaveCount(1);
    await shots(o, 'auditor-b-only');
    step('BACKUP');
    await restoreCompleteBackup(b, browser, contexts, monitors);
    step('SCREENS');
    for (const name of ['Wallet', 'Pay', 'Receive', 'Books', 'Grants']) {
      await navigate(b, name);
      await shots(b, name.toLowerCase());
    }
    await navigate(b, 'Public check');
    await b.getByLabel('Book ID (demo)', { exact: true }).fill(id);
    await b.getByRole('button', { name: 'Check chain', exact: true }).click();
    await expect(b.getByText('anchored entries', { exact: true })).toBeVisible({ timeout: 300000 });
    await shots(b, 'public');
    await b.getByRole('button', { name: 'Account', exact: true }).click();
    await shots(b, 'account');
    o = await openOther();
    await o.goto('/');
    await shots(o, 'landing');
    const network = [];
    for (const monitor of monitors) network.push(await monitor.finish());
    expect(
      network.every((value) => value.leaks === 0 && value.errors.length === 0 && value.requests === value.responses),
    ).toBe(true);
    writeFileSync(
      `../../evidence/${run}-browser.json`,
      JSON.stringify(
        {
          command: `pnpm evidence --${run}`,
          at: new Date().toISOString(),
          status: 'PASSED',
          label: fixture.label,
          bookId: id,
          baseline: plan,
          client: await snapshot(c),
          business: await snapshot(b),
          auditor: {
            A: { entries: 3, all: 'MATCHED', holdings: 'HOLDINGS_COVER_BOOKS' },
            B: { entries: 2, all: 'MATCHED', holdings: 'HOLDINGS_COVER_BOOKS' },
            C: 'NOT_GRANTED',
          },
          bOnly: { A: 'NOT_GRANTED', B: ['MATCHED', 'MATCHED', 'HOLDINGS_COVER_BOOKS'], C: 'NOT_GRANTED' },
          backupRestoredPrivateBalanceMatches: true,
          network,
          screenshots: `evidence/${run}-screens/`,
          screenshotsMaskPrivateLedgerCells: !fixture.publicDemo,
          openingBasis: 'opening balance as declared and signed by the business',
          notEstablished: [
            'correctness of the declared opening balance for periods after the first',
            'compromised browsers or extensions',
            'other flows',
            'Groth16 soundness',
            'metadata privacy',
          ],
        },
        null,
        2,
      ) + '\n',
    );
    step('PASSED');
  } catch (error: unknown) {
    writeFileSync(
      `../../evidence/${run}-attempt-${String(Date.now())}.json`,
      JSON.stringify({
        command: `pnpm evidence --${run}`,
        status: 'FAILED',
        stage: readFileSync(`${folder}/stage.txt`, 'utf8'),
        code: error instanceof Error ? error.name : 'FAILED',
        network: await Promise.all(monitors.map((monitor) => monitor.finish())),
      }) + '\n',
    );
    throw error;
  } finally {
    await checkpoint(client, 'client');
    await checkpoint(business, 'business');
    await checkpoint(other, 'other');
    for (const context of contexts) await context.close();
  }
});
