import { it, expect } from 'vitest';
import { relayRequestPath } from '../server/relayPath.js';
import { relayPlan } from '../server/qorePolicy.js';
it('T-RELAY Vercel wildcard routing preserves the allowlist and refuses ambiguous paths', () => {
  const publicPath = 'rest/qorechain/pqc/v1/protocol_features';
  expect(relayPlan(relayRequestPath(`/api/qore-relay?qorePath=${publicPath}`), 'GET', undefined).url).toBe(
    'https://api-testnet.qore.host/qorechain/pqc/v1/protocol_features',
  );
  expect(relayRequestPath('/api/qore/rpc')).toBe('/api/qore/rpc');
  for (const input of [
    '/api/qore-relay?qorePath=rpc&qorePath=rest',
    '/api/qore-relay?qorePath=rpc&extra=1',
    '/api/qore-relay?qorePath=../rpc',
    '/api/qore-relay?qorePath=https%3A%2F%2Fexample.com',
  ])
    expect(() => relayRequestPath(input)).toThrow('RELAY_PATH_REFUSED');
  expect(() =>
    relayPlan(relayRequestPath('/api/qore-relay?qorePath=rest/not-allowlisted'), 'GET', undefined),
  ).toThrow();
});
