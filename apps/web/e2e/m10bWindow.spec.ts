import { test, expect, chromium } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { m9Fixtures } from './m9Fixtures.js';
test('S-WINDOW-REOPEN demo business replaces a live small window and spends from the larger budget', async ({
  baseURL,
}) => {
  if (baseURL !== 'http://127.0.0.1:5173') throw new Error('LOCAL_SPIKE_ORIGIN_REQUIRED');
  const fixture = m9Fixtures(),
    business = fixture.roles.business;
  if (!business) throw new Error('DEMO_BUSINESS_REQUIRED');
  mkdirSync('../../.accounts/m10b-window-profile', { recursive: true, mode: 0o700 });
  const context = await chromium.launchPersistentContext('../../.accounts/m10b-window-profile', { headless: true });
  const page = await context.newPage();
  const target = '../../evidence/m10b-window-reopen.json';
  if (existsSync(target)) copyFileSync(target, target.replace('.json', `-attempt-${String(Date.now())}.json`));
  try {
    await page.goto(baseURL);
    const result: unknown = await page.evaluate(
      async ({ backup, password, address }) => {
        const path = '/e2e/m10bWindowDriver.ts';
        const driver = (await import(path)) as typeof import('./m10bWindowDriver.js');
        const result = await driver.windowSpike(backup, password, address);
        return JSON.parse(
          JSON.stringify(result, (_, value: unknown) => (typeof value === 'bigint' ? value.toString() : value)),
        ) as unknown;
      },
      {
        backup: JSON.parse(readFileSync(business.backup, 'utf8')) as unknown,
        password: fixture.password,
        address: business.address,
      },
    );
    writeFileSync(
      target,
      JSON.stringify(
        {
          command: 'pnpm evidence --m10b-window-reopen',
          commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
          at: new Date().toISOString(),
          demo: true,
          result,
        },
        null,
        2,
      ) + '\n',
    );
    expect(result).toMatchObject({ outcome: 'REPLACED', evm: { kind: 'LANDED' }, after: { remainingTxs: '2' } });
  } finally {
    await context.close();
  }
});
