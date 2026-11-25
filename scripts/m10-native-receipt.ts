import { z } from 'zod';
import { TxRaw, AuthInfo } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
export async function m10NativeReceipt(rpc: string, record: { hash: string; block: string; step: string }) {
  const hash = z
    .string()
    .regex(/^[A-F0-9]{64}$/)
    .parse(record.hash.toUpperCase());
  const response = await fetch(rpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tx_search',
      params: { query: `tx.hash='${hash}'`, page: '1', prove: false },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error('RECEIPT_UNAVAILABLE');
  const result = z
    .object({
      result: z
        .object({
          txs: z
            .array(
              z
                .object({
                  hash: z.literal(hash),
                  height: z.literal(record.block),
                  tx: z.string(),
                  tx_result: z
                    .object({
                      code: z.literal(0),
                      gas_used: z.string().regex(/^\d+$/),
                      gas_wanted: z.string().regex(/^\d+$/),
                    })
                    .passthrough(),
                })
                .passthrough(),
            )
            .length(1),
        })
        .passthrough(),
    })
    .passthrough()
    .parse((await response.json()) as unknown);
  const transaction = result.result.txs[0];
  if (!transaction) throw new Error('RECEIPT_REQUIRED');
  const raw = TxRaw.decode(Buffer.from(transaction.tx, 'base64'));
  const fee = AuthInfo.decode(raw.authInfoBytes).fee;
  if (!fee || fee.amount.length !== 1 || fee.amount[0]?.denom !== 'uqor') throw new Error('NATIVE_FEE_REQUIRED');
  return {
    ...record,
    hash,
    code: 0,
    gasUsed: transaction.tx_result.gas_used,
    gasWanted: transaction.tx_result.gas_wanted,
    feeUqor: z.string().regex(/^\d+$/).parse(fee.amount[0].amount),
  };
}
