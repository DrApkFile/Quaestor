import { m2Context, m2Root } from './m2Context.js';
import { writePrivateJson } from '../src/storage.js';
import { addressSchema } from '../src/config.js';
const context = await m2Context('deployer', 'm4');
const operation = context.journal.read().operations.find((item) => item.id === 'm4-deploy-books');
if (!operation?.hash) throw new Error('TRANSACTION_HASH_REQUIRED');
let observation: unknown = {
  status: 'OUTCOME_UNKNOWN',
  hash: operation.hash,
  version: 'UNCONFIRMED',
  reason: 'receipt not observed after resolution timeout; operation held',
};
try {
  const receipt = await context.reader.getTransactionReceipt({ hash: operation.hash });
  observation = {
    status: receipt.status,
    hash: receipt.transactionHash,
    block: receipt.blockNumber.toString(),
    address: addressSchema.parse(receipt.contractAddress),
    version: 'v1 artifact (not v2)',
  };
} catch (error: unknown) {
  if (!(error instanceof Error) || !error.name.includes('TransactionReceiptNotFound')) throw error;
}
const evidence = {
  command: 'pnpm evidence --m4-deploy-recover',
  label: 'interrupted stale-artifact deployment',
  at: new Date().toISOString(),
  observation,
  resent: false,
  held: true,
};
writePrivateJson(`${m2Root}/evidence/m4-deploy-recovery.json`, evidence);
console.log(JSON.stringify(evidence, null, 2));
