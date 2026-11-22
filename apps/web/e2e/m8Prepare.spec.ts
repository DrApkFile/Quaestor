import { test, expect } from '@playwright/test';
import { existsSync, writeFileSync } from 'node:fs';
import { folder } from './m6Fixtures.js';
import { unlock, snapshot, storage, checkpoint, prepare, action, navigate } from './m6Driver.js';
test('Prepare separate demo notes before registering the new book', async ({ browser }) => {
  test.setTimeout(1800000);
  if (existsSync(`${folder}/plan.json`)) return;
  const business = await browser.newContext(storage('business'));
  const client = await browser.newContext(storage('client'));
  try {
    const b = await business.newPage(),
      c = await client.newPage();
    await unlock(b, 'business');
    await unlock(c, 'client');
    await prepare(b);
    await navigate(b, 'Wallet');
    const owned = b
      .locator('tbody tr')
      .filter({ has: b.getByRole('button', { name: 'Cash out', exact: true }).and(b.locator(':enabled')) });
    while ((await owned.count()) > 2) {
      const values = await owned.locator('[data-label=Amount]').allTextContents();
      const index = values.indexOf([...values].sort((a, z) => Number.parseFloat(a) - Number.parseFloat(z))[0] ?? '');
      expect(index).toBeGreaterThanOrEqual(0);
      await action(b, () => owned.nth(index).getByRole('button', { name: 'Cash out', exact: true }).click());
      await checkpoint(business, 'business');
    }
    const state = await snapshot(b),
      payer = await snapshot(c);
    writeFileSync(
      `${folder}/plan.json`,
      JSON.stringify({
        client: payer.payments.filter((p) => p.direction === 'OUT').length,
        business: state.payments.filter((p) => p.direction === 'OUT').length,
        oldBooks: state.books.map((book) => book.id),
      }),
      { mode: 0o600 },
    );
    writeFileSync(
      `../../evidence/${process.env.QUAESTOR_DEMO_RUN ?? 'm8-privacy'}-preparation.json`,
      JSON.stringify(
        {
          command: `pnpm evidence --${process.env.QUAESTOR_DEMO_RUN ?? 'm8-privacy'}`,
          purpose:
            'Own-address testnet cash-outs reduce note count before registering a fresh book; the pool cannot merge notes.',
          status: 'PASSED',
          business: state,
        },
        null,
        2,
      ) + '\n',
    );
  } finally {
    await checkpoint(business, 'business');
    await checkpoint(client, 'client');
    await business.close();
    await client.close();
  }
});
