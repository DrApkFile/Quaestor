import { it, expect } from 'vitest';
import { relayPlan } from '../server/qorePolicy.js';
it('T-RELAY rejects arbitrary hosts, private-key fields, non-public methods and unsigned bodies', () => {
  expect(() => relayPlan('/api/qore/https://example.com', 'GET', null)).toThrow();
  expect(() => relayPlan('/api/qore/rest/anything', 'GET', null)).toThrow();
  expect(() =>
    relayPlan('/api/qore/rpc', 'POST', {
      jsonrpc: '2.0',
      id: 1,
      method: 'sign',
      params: { privateKey: 'synthetic forbidden field' },
    }),
  ).toThrow();
  expect(() =>
    relayPlan('/api/qore/rpc', 'POST', {
      jsonrpc: '2.0',
      id: 1,
      method: 'status',
      params: { mnemonic: 'synthetic forbidden field' },
    }),
  ).toThrow();
  expect(() =>
    relayPlan('/api/qore/rpc', 'POST', {
      jsonrpc: '2.0',
      id: 1,
      method: 'broadcast_tx_sync',
      params: { tx: 'aGVsbG8=' },
    }),
  ).toThrow();
  expect(relayPlan('/api/qore/rpc', 'POST', { jsonrpc: '2.0', id: 1, method: 'status', params: {} }).url).toBe(
    'https://rpc-testnet.qore.host',
  );
});
