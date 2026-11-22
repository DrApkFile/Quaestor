import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { privacyMonitor } from './m6Privacy.js';
import { shots } from './m7Tools.js';
test('T-NOPLAIN-WEB M7 attack lab reads four chain cases and never broadcasts', async ({ browser }) => {
  test.setTimeout(600000);
  const context = await browser.newContext();
  const monitor = privacyMonitor(context);
  const mutations: string[] = [];
  context.on('request', (request) => {
    const body = request.postData() ?? '';
    if (/eth_sendRawTransaction|eth_sendTransaction|broadcast_tx|wallet_|personal_/.test(body))
      mutations.push('TRANSACTION_REQUEST');
  });
  await monitor.start();
  const page = await context.newPage();
  try {
    await page.goto('/attack-lab');
    const routing = await page.evaluate(async () => {
      const allowed = await fetch('/api/qore-relay?qorePath=rest/qorechain/pqc/v1/protocol_features');
      const refused = await fetch('/api/qore-relay?qorePath=rest/not-allowlisted');
      const document = await fetch('/');
      return {
        allowed: allowed.status,
        refused: refused.status,
        contentType: allowed.headers.get('content-type'),
        csp: document.headers.get('content-security-policy'),
      };
    });
    expect(routing.allowed).toBe(200);
    expect(routing.refused).toBe(400);
    expect(routing.contentType).toContain('application/json');
    expect(routing.csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
    await page.getByRole('button', { name: 'Read attack book from chain', exact: true }).click();
    await expect(page.getByTestId('attack-duplicate')).toHaveText('UNBACKED (DUPLICATE_PAYMENT)', { timeout: 480000 });
    await expect(page.getByTestId('attack-first')).toHaveText('MATCHED');
    await expect(page.getByTestId('attack-context')).toHaveText('UNBACKED (WRONG_CONTEXT)');
    await expect(page.getByTestId('attack-tampered')).toHaveText('TAMPERED');
    await expect(page.getByTestId('attack-holdings')).toHaveText('HOLDINGS_SHORT');
    await shots(page, 'attack-lab');
    const network = await monitor.finish();
    expect(mutations).toEqual([]);
    expect(network.leaks).toBe(0);
    expect(network.errors).toEqual([]);
    expect(network.requests).toBe(network.responses);
    writeFileSync(
      '../../evidence/m7-attack-browser.json',
      JSON.stringify(
        {
          command: 'pnpm evidence --m7',
          at: new Date().toISOString(),
          status: 'PASSED',
          m4: ['TAMPERED', 'UNBACKED (WRONG_CONTEXT)', 'HOLDINGS_SHORT'],
          duplicate: ['MATCHED', 'UNBACKED (DUPLICATE_PAYMENT)'],
          readBlocks: await page.locator('main > .muted').textContent(),
          transactionRequests: mutations.length,
          routing,
          network,
          screenshots: 'evidence/m7-screens/attack-lab-{390,1440}.png',
        },
        null,
        2,
      ) + '\n',
    );
  } catch (error: unknown) {
    writeFileSync(
      `../../evidence/m7-attack-attempt-${String(Date.now())}.json`,
      JSON.stringify({
        command: 'pnpm evidence --m7',
        status: 'FAILED',
        code: error instanceof Error ? error.name : 'FAILED',
        network: await monitor.finish(),
        transactionRequests: mutations.length,
      }) + '\n',
    );
    throw error;
  } finally {
    await context.close();
  }
});
