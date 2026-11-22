import { z } from 'zod';
import { TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
const addr = 'qor1[0-9a-z]{20,80}';
const restPath = new RegExp(
  `^/(?:qorechain/pqc/v1/(?:kem|account|evm_window)/${addr}|cosmos/auth/v1beta1/accounts/${addr}|cosmos/bank/v1beta1/balances/${addr}|qorechain/pqc/v1/protocol_features|cosmos/upgrade/v1beta1/applied_plan/(?:v3\\.2\\.0|v3\\.1\\.98))$`,
);
const hash = z
  .string()
  .refine(
    (value) =>
      /^(?:0x)?[\da-fA-F]{64}$/.test(value) ||
      (/^[A-Za-z0-9+/]{43}=$/.test(value) && Buffer.from(value, 'base64').length === 32),
    'TX_HASH_REQUIRED',
  );
const tx = z
  .string()
  .regex(/^[A-Za-z0-9+/]+={0,2}$/)
  .max(350000);
const schemas = {
  status: z.object({}).strict().default({}),
  tx: z.object({ hash, prove: z.boolean().optional() }).strict(),
  tx_search: z
    .object({
      query: z.string().regex(/^tx\.hash='[\dA-Fa-f]{64}'$/),
      page: z.literal('1').optional(),
      prove: z.boolean().optional(),
    })
    .strict(),
  broadcast_tx_sync: z.object({ tx }).strict(),
};
const rpc = z
  .object({
    jsonrpc: z.literal('2.0'),
    id: z.union([z.string().max(80), z.number().int(), z.null()]),
    method: z.enum(['status', 'tx', 'tx_search', 'broadcast_tx_sync']),
    params: z.unknown(),
  })
  .strict();
export function relayPlan(path: string, method: string, body: unknown) {
  const url = new URL(path, 'https://quaestor.invalid');
  if (url.search) throw new Error('RELAY_PATH_REFUSED');
  if (url.pathname.startsWith('/api/qore/rest/')) {
    const target = url.pathname.slice('/api/qore/rest'.length);
    if (method !== 'GET' || !restPath.test(target)) throw new Error('RELAY_PATH_REFUSED');
    return { url: `https://api-testnet.qore.host${target}`, method: 'GET' as const, body: undefined };
  }
  if ((url.pathname === '/api/qore/rpc' || url.pathname === '/api/qore/rpc/') && method === 'POST') {
    const value = rpc.parse(body);
    schemas[value.method].parse(value.params);
    if (value.method === 'broadcast_tx_sync') {
      const { tx } = schemas.broadcast_tx_sync.parse(value.params);
      const bytes = Buffer.from(tx, 'base64');
      if (bytes.toString('base64') !== tx) throw new Error('RELAY_UNSIGNED_REFUSED');
      const raw = TxRaw.decode(bytes);
      if (
        !raw.bodyBytes.length ||
        !raw.authInfoBytes.length ||
        raw.signatures.length !== 1 ||
        raw.signatures[0]?.length !== 64
      )
        throw new Error('RELAY_UNSIGNED_REFUSED');
    }
    return { url: 'https://rpc-testnet.qore.host', method: 'POST' as const, body: JSON.stringify(value) };
  }
  throw new Error('RELAY_PATH_REFUSED');
}
