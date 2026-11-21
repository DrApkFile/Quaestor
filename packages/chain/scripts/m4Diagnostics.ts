import { z } from 'zod';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256 } from 'viem';
import { m2Context, m2Root } from './m2Context.js';
import { readJson } from './m3Shared.js';
import { hexSchema } from '../src/config.js';
import { writePrivateJson } from '../src/storage.js';
const context = await m2Context('deployer', 'm4');
const deployment = z
  .object({ v2: z.object({ transaction: z.object({ hash: hexSchema }).passthrough() }).passthrough() })
  .passthrough()
  .parse(readJson(`${m2Root}/evidence/m4-books-v2.json`));
const old = context.journal.read().operations.find((operation) => operation.id === 'm4-deploy-books');
if (!old?.hash || !old.prepared || !old.gas) throw new Error('LEGACY_CHECKPOINT_REQUIRED');
const v2 = await context.reader.getTransaction({ hash: deployment.v2.transaction.hash });
const receipt = await context.reader.getTransactionReceipt({ hash: v2.hash });
if (v2.from.toLowerCase() !== context.account.evm.toLowerCase() || receipt.status !== 'success')
  throw new Error('V2_RECEIPT_REQUIRED');
const signer = privateKeyToAccount(hexSchema.parse(context.account.privateKey));
let legacyNonce: number | null = null;
for (let candidate = Math.max(0, v2.nonce - 8); candidate <= v2.nonce; candidate++) {
  const serialized = await signer.signTransaction({
    chainId: 9800,
    data: old.prepared.data,
    value: BigInt(old.prepared.valueWei),
    nonce: candidate,
    gas: BigInt(old.gas.gasLimit),
    maxFeePerGas: BigInt(old.gas.maxFeePerGas),
    maxPriorityFeePerGas: 1_000_000_000n,
    type: 'eip1559',
  });
  if (keccak256(serialized) === old.hash) {
    legacyNonce = candidate;
    break;
  }
}
const consumed = legacyNonce !== null && legacyNonce <= v2.nonce;
const query = `message.sender='${context.account.cosmos}' AND tx.height>=10493000 AND tx.height<=10493800`;
const response = await fetch(context.config.consensusRpc, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tx_search',
    params: { query, prove: false, per_page: '100', order_by: 'asc' },
  }),
});
if (!response.ok) throw new Error('RPC_HISTORY_UNAVAILABLE');
const attribute = z.object({ key: z.string(), value: z.string() }).passthrough();
const data = z
  .object({
    result: z
      .object({
        total_count: z.string(),
        txs: z.array(
          z
            .object({
              hash: z.string().regex(/^[\dA-F]{64}$/),
              height: z.string(),
              tx_result: z
                .object({
                  code: z.number(),
                  events: z.array(z.object({ type: z.string(), attributes: z.array(attribute) }).passthrough()),
                })
                .passthrough(),
            })
            .passthrough(),
        ),
      })
      .passthrough(),
  })
  .passthrough()
  .parse(await response.json());
const evidence = {
  command: 'pnpm evidence --m4-deployment-diagnostics',
  at: new Date().toISOString(),
  legacySignedHash: old.hash,
  legacyReceiptStatus: 'not observed; original checkpoint preserved',
  v2Hash: v2.hash,
  v2Block: receipt.blockNumber.toString(),
  confirmedV2Nonce: v2.nonce,
  legacySignedNonce: legacyNonce,
  signatureMatchedSavedHash: legacyNonce !== null,
  legacyCannotLandAfterConfirmedV2: consumed,
  resent: false,
  nativeHistory: data.result.txs.map((tx) => ({
    hash: tx.hash,
    height: tx.height,
    code: tx.tx_result.code,
    actions: tx.tx_result.events
      .filter((e) => e.type === 'message')
      .flatMap((e) => e.attributes.filter((a) => a.key === 'action').map((a) => a.value)),
  })),
};
writePrivateJson(`${m2Root}/evidence/m4-deployment-nonce-resolution.json`, evidence);
console.log(JSON.stringify(evidence, null, 2));
