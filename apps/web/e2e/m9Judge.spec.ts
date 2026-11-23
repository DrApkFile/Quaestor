import { test, expect } from '@playwright/test';
import { m9Screens } from './m9Screens.js';
import { m9Privacy } from './m9Privacy.js';
import { m9Fixtures } from './m9Fixtures.js';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
const demo = z
  .object({ honest: z.string() })
  .passthrough()
  .parse(JSON.parse(readFileSync('public/m7-demo.json', 'utf8')) as unknown);
import { demoAuditorPassphrase } from '../src/demo.js';
test('M9 live judge path and responsive accessibility', async ({ page, context, baseURL }) => {
  const phase = process.env.QUAESTOR_M9_PHASE ?? 'before';
  mkdirSync('../../evidence/m9-screens', { recursive: true });
  const fixture = m9Fixtures();
  const monitor = m9Privacy(context, [fixture.password]);
  await monitor.start();
  const screens = [];
  let transactionRequests = 0;
  context.on('request', (request) => {
    if (/eth_sendRawTransaction|eth_sendTransaction|broadcast_tx/.test(request.postData() ?? '')) transactionRequests++;
  });
  const failures: string[] = [];
  for (const view of ['landing', 'public', 'auditor', 'attack', 'account']) {
    console.log(`M9 judge ${phase}: ${view}`);
    await page.goto(
      view === 'landing' ? '/' : view === 'attack' ? '/attack-lab' : `/app?view=${view}&book=${demo.honest}`,
    );
    await expect(page.locator('h1:visible')).toBeVisible({ timeout: 60000 });
    const initialJavascript = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .filter((entry) => /\.js(?:$|\?)/.test(entry.name))
        .map((entry) => ({
          name: new URL(entry.name).pathname,
          bytes: (entry as PerformanceResourceTiming).encodedBodySize,
        })),
    );
    try {
      if (view === 'public') {
        await page.getByRole('button', { name: 'Check chain', exact: true }).click();
        await expect(
          page.getByText('anchored entries', { exact: true }).or(page.getByRole('alert').filter({ visible: true })),
        ).toBeVisible({ timeout: 300000 });
        await expect(page.getByText('anchored entries', { exact: true })).toBeVisible();
      }
      if (view === 'auditor') {
        if (phase === 'after') await page.getByRole('button', { name: 'Try the demo auditor', exact: true }).click();
        else {
          await page.getByLabel('Encrypted backup file', { exact: true }).setInputFiles('public/demo-auditor.json');
          await page.getByLabel('Backup passphrase', { exact: true }).fill(demoAuditorPassphrase);
          await page.getByRole('button', { name: 'Open granted period', exact: true }).click();
        }
        await expect(
          page
            .getByTestId('entry-verdict')
            .first()
            .or(page.getByRole('alert').filter({ visible: true })),
        ).toBeVisible({ timeout: 600000 });
        await expect(page.getByTestId('entry-verdict')).toHaveCount(5);
        await expect(page.getByTestId('period-verdict')).toHaveCount(2);
        if (phase === 'after') {
          for (const badge of await page.getByTestId('entry-verdict').all())
            await expect(badge).toHaveAttribute('data-code', 'MATCHED');
          for (const badge of await page.getByTestId('period-verdict').all())
            await expect(badge).toHaveAttribute('data-code', 'HOLDINGS_COVER_BOOKS');
          await expect(page.locator('[data-code=NOT_GRANTED]')).toHaveCount(1);
        }
      }
      if (view === 'attack') {
        await page.getByRole('button', { name: 'Read attack book from chain', exact: true }).click();
        await expect(
          page.getByTestId('attack-duplicate').or(page.getByRole('alert').filter({ visible: true })),
        ).toBeVisible({ timeout: 600000 });
        await expect(page.getByTestId('attack-duplicate')).toBeVisible();
      }
    } catch {
      failures.push(view);
    }
    screens.push(...(await m9Screens(page, phase, view)).map((screen) => ({ ...screen, initialJavascript })));
  }
  const business = fixture.roles.business;
  if (!business) throw new Error('BUSINESS_FIXTURE_REQUIRED');
  await page.goto('/app?view=account');
  await page.getByLabel('Passphrase', { exact: true }).fill(fixture.password);
  await page.getByLabel('Restore encrypted backup', { exact: true }).setInputFiles(business.backup);
  await expect(page.getByRole('button', { name: 'Download backup', exact: true })).toBeEnabled({ timeout: 60000 });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  await download;
  await page.waitForFunction(() => !!window.quaestorM6, {}, { timeout: 60000 });
  for (const view of ['Wallet', 'Pay', 'Receive', 'Books', 'Grants']) {
    await page.getByRole('navigation').getByRole('button', { name: view, exact: true }).click();
    await expect(page.locator('h1:visible')).toBeVisible();
    screens.push(...(await m9Screens(page, phase, view.toLowerCase())));
  }

  const network = await monitor.finish();
  const filename = `../../evidence/m9-judge-${phase}.json`;
  if (existsSync(filename))
    copyFileSync(filename, `../../evidence/m9-judge-${phase}-attempt-${String(Date.now())}.json`);
  writeFileSync(
    filename,
    JSON.stringify(
      {
        command: 'pnpm evidence --m9-judge',
        origin: baseURL,
        at: new Date().toISOString(),
        status:
          failures.length ||
          transactionRequests ||
          network.leaks ||
          network.errors.length ||
          network.pendingInspections ||
          network.requests !== network.responses
            ? 'FAILED'
            : 'PASSED',
        network,
        transactionRequests,
        failures,
        screens,
      },
      null,
      2,
    ) + '\n',
  );
  expect(failures).toEqual([]);
  if (phase === 'after') {
    expect(network.leaks).toBe(0);
    expect(network.errors).toEqual([]);
    expect(network.pendingInspections).toBe(0);
    expect(network.requests).toBe(network.responses);
    expect(transactionRequests).toBe(0);
    for (const screen of screens) {
      expect(screen.fits).toBe(true);
      expect(screen.violations.filter((value) => value.impact === 'serious' || value.impact === 'critical')).toEqual(
        [],
      );
    }
  }
});
