import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { createPublicClient, http, formatEther, formatUnits, parseEther } from 'viem';
import { TxRaw, AuthInfo } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
const root = new URL('../', import.meta.url);
const run = z
  .object({
    status: z.literal('PASSED'),
    activationCostQor: z.string(),
    activationMs: z.number().int().positive(),
    activation: z
      .array(z.object({ hash: z.string(), block: z.string().regex(/^\d+$/), step: z.string() }).strict())
      .length(4),
  })
  .passthrough()
  .parse(JSON.parse(readFileSync(new URL('evidence/m9-fresh-signup.json', root), 'utf8')) as unknown);
const config = z
  .object({
    chain: z
      .object({ chainId: z.literal(9800), evmRpc: z.string().url(), consensusRpc: z.string().url() })
      .passthrough(),
  })
  .passthrough()
  .parse(JSON.parse(readFileSync(new URL('config/m5.json', root), 'utf8')) as unknown);
const client = createPublicClient({ transport: http(config.chain.evmRpc, { retryCount: 0 }) });
if ((await client.getChainId()) !== 9800) throw new Error('DIANA_REQUIRED');
const card = run.activation.find((record) => record.step.startsWith('card-'));
if (!card) throw new Error('CARD_RECEIPT_REQUIRED');
const cardHash = z
  .string()
  .regex(/^0x[a-f0-9]{64}$/)
  .parse(card.hash) as `0x${string}`;
const receipt = await client.getTransactionReceipt({ hash: cardHash });
if (receipt.status !== 'success' || receipt.blockNumber.toString() !== card.block)
  throw new Error('CARD_RECEIPT_MISMATCH');
const native = [];
let nativeUqor = 0n;
for (const record of run.activation.filter((value) => !value.step.startsWith('card-'))) {
  const hash = z
    .string()
    .regex(/^[A-F0-9]{64}$/)
    .parse(record.hash);
  const response = await fetch(config.chain.consensusRpc, {
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
  const amount = z.string().regex(/^\d+$/).parse(fee.amount[0].amount);
  nativeUqor += BigInt(amount);
  native.push({
    hash,
    block: record.block,
    step: record.step,
    gasUsed: transaction.tx_result.gas_used,
    gasWanted: transaction.tx_result.gas_wanted,
    feeUqor: amount,
  });
}
const cardWei = receipt.gasUsed * receipt.effectiveGasPrice;
const total = nativeUqor * 1000000000000n + cardWei;
if (total !== parseEther(run.activationCostQor)) throw new Error('ACTIVATION_COST_MISMATCH');
const at = new Date().toISOString();
const report = {
  command: 'pnpm evidence --m9-cost',
  status: 'PASSED',
  at,
  network: 'qorechain-diana',
  native,
  card: {
    hash: cardHash,
    block: card.block,
    gasUsed: receipt.gasUsed.toString(),
    effectiveGasPrice: receipt.effectiveGasPrice.toString(),
    feeQor: formatEther(cardWei),
  },
  totalQor: formatEther(total),
  uiBalanceDeltaQor: run.activationCostQor,
  activationMs: run.activationMs,
  limits:
    'One observed activation, not a fixed future fee; faucet funding and screenshot/backup time excluded from activationMs.',
};
writeFileSync(new URL('evidence/m9-activation-cost.json', root), JSON.stringify(report, null, 2) + '\n');
const bufferedWei = (total * 125n + 99n) / 100n;
const centiQor = (bufferedWei + 10000000000000000n - 1n) / 10000000000000000n;
writeFileSync(
  new URL('apps/web/public/activation-estimate.json', root),
  JSON.stringify(
    {
      network: 'qorechain-diana',
      measuredAt: at,
      costQor: report.totalQor,
      estimatedSetupQor: formatUnits(centiQor, 2),
      cardGasUsed: report.card.gasUsed,
      source: 'evidence/m9-activation-cost.json',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `M9 activation cost verified from receipts: ${report.totalQor} QOR; card ${report.card.gasUsed} gas; UI balance delta matches.`,
);
