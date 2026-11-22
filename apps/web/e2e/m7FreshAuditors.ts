import { expect, type Browser } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { hex32 } from '@quaestor/core';
import { demoAuditorPassphrase } from '../src/demo.js';
import { audit, shots } from './m7Tools.js';
import { privacyMonitor } from './m6Privacy.js';
import { navigate } from './m6Driver.js';
import { fixture } from './m6Fixtures.js';
export async function freshAuditors(browser: Browser) {
  const run = process.env.QUAESTOR_DEMO_RUN ?? 'm7';
  const { bookId } = z
    .object({ bookId: hex32 })
    .passthrough()
    .parse(JSON.parse(readFileSync(`../../evidence/${run}-browser.json`, 'utf8')) as unknown);
  const results = [];
  for (const role of ['auditor', 'client'] as const) {
    const context = await browser.newContext();
    const monitor = privacyMonitor(context),
      mutations: string[] = [];
    context.on('request', (request) => {
      if (/eth_sendRawTransaction|eth_sendTransaction|broadcast_tx|wallet_|personal_/.test(request.postData() ?? ''))
        mutations.push('TRANSACTION_REQUEST');
    });
    await monitor.start();
    const page = await context.newPage();
    try {
      if (fixture.publicDemo && role === 'auditor') {
        await page.goto('/');
        await expect(page.getByRole('link', { name: 'Public check', exact: true })).toHaveAttribute(
          'href',
          `/app?view=public&book=${bookId}`,
        );
        await expect(page.getByRole('link', { name: 'Auditor', exact: true })).toHaveAttribute(
          'href',
          `/app?view=auditor&book=${bookId}`,
        );
        await shots(page, 'landing');
      }
      await audit(
        page,
        bookId,
        role,
        role === 'auditor' ? 5 : 2,
        role === 'auditor' ? { file: 'public/demo-auditor.json', passphrase: demoAuditorPassphrase } : undefined,
      );
      await expect(page.getByTestId('period-verdict')).toHaveCount(role === 'auditor' ? 2 : 1);
      await shots(page, role === 'auditor' ? 'auditor-fresh' : 'auditor-b-only-fresh');
      if (role === 'auditor') {
        await navigate(page, 'Public check');
        await page.getByLabel('Book ID (demo)', { exact: true }).fill(bookId);
        await page.getByRole('button', { name: 'Check chain', exact: true }).click();
        await expect(page.getByText('anchored entries', { exact: true })).toBeVisible({ timeout: 300000 });
        await shots(page, 'public');
      }
      const network = await monitor.finish();
      expect(network.leaks).toBe(0);
      expect(network.errors).toEqual([]);
      expect(network.requests).toBe(network.responses);
      expect(mutations).toEqual([]);
      results.push({
        role,
        freshContext: true,
        granted: role === 'auditor' ? ['A', 'B'] : ['B'],
        matched: role === 'auditor' ? 5 : 2,
        holdings: 'HOLDINGS_COVER_BOOKS',
        refused: role === 'auditor' ? ['C'] : ['A', 'C'],
        transactionRequests: mutations.length,
        network,
      });
    } catch (error: unknown) {
      writeFileSync(
        `../../evidence/${run}-fresh-auditor-attempt-${String(Date.now())}.json`,
        JSON.stringify({
          command: `pnpm evidence --${run}`,
          status: 'FAILED',
          role,
          code: error instanceof Error ? error.name : 'FAILED',
          network: await monitor.finish(),
          transactionRequests: mutations.length,
        }) + '\n',
      );
      throw error;
    } finally {
      await context.close();
    }
  }
  writeFileSync(
    `../../evidence/${run}-fresh-auditors.json`,
    JSON.stringify(
      { command: `pnpm evidence --${run}`, at: new Date().toISOString(), status: 'PASSED', bookId, results },
      null,
      2,
    ) + '\n',
  );
}
