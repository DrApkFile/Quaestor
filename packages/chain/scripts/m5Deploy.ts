import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { m2Context, m2Root } from './m2Context.js';
import { loadPoolAbi } from '../src/abi.js';
import { addressSchema, hexSchema } from '../src/config.js';
import { readJson } from './m3Shared.js';
import { writePrivateJson } from '../src/storage.js';
import { openWindow } from '../src/window.js';
import { createGateway } from '../src/gateway.js';
import { executeOperation, resolveOperation } from '../src/executor.js';
import { paymentEvidence } from '../src/evidence.js';
const output = `${m2Root}/evidence/m5-blob-deploy.json`;
if (existsSync(output)) throw new Error('BLOB_BOARD_ALREADY_DEPLOYED');
execFileSync('forge', ['build'], { cwd: `${m2Root}/contracts`, stdio: 'pipe' });
const context = await m2Context('deployer', 'm5-deploy');
const artifactPath = `${m2Root}/contracts/out/BlobBoard.sol/BlobBoard.json`;
const code = z
  .object({ bytecode: z.object({ object: hexSchema }).passthrough() })
  .passthrough()
  .parse(readJson(artifactPath));
const gateway = createGateway(context.config, context.account, context.reader, context.poolAbi, null);
const existing = context.journal.read().operations.find((o) => o.id === 'm5-blob-deploy');
if (existing?.stage === 'OUTCOME_UNKNOWN' || existing?.stage === 'BROADCAST') {
  const settled = await resolveOperation(context.journal, existing.id, gateway);
  if (settled.kind !== 'LANDED') throw new Error(settled.kind);
}
const windowPath = `${m2Root}/.accounts/m5-deploy/window.json`;
if (!context.journal.read().operations.some((o) => o.id === 'm5-blob-deploy' && o.stage === 'LANDED')) {
  const window = await openWindow(context.config, context.account, 1n, 500000n);
  writePrivateJson(windowPath, window.transaction);
}
const outcome = await executeOperation(
  context.journal,
  {
    id: 'm5-blob-deploy',
    input: null,
    requestKey: code.bytecode.object,
    build: () =>
      Promise.resolve({
        data: code.bytecode.object,
        valueWei: '0',
        outputs: [],
        root: null,
        nullifier: null,
        feeWei: '0',
      }),
  },
  gateway,
);
if (outcome.kind !== 'LANDED' || !outcome.operation.hash) throw new Error(outcome.kind);
const receipt = await context.reader.getTransactionReceipt({ hash: outcome.operation.hash });
const address = addressSchema.parse(receipt.contractAddress);
const evidence = {
  command: 'pnpm evidence --m5-deploy',
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: m2Root, encoding: 'utf8' }).trim(),
  at: new Date().toISOString(),
  address,
  deployBlock: receipt.blockNumber.toString(),
  transaction: paymentEvidence(outcome.operation),
  window: readJson(windowPath),
  permissionless: true,
  eventOnly: true,
  maximumBytes: 24576,
  abi: loadPoolAbi(artifactPath),
};
writePrivateJson(output, evidence);
console.log(JSON.stringify(evidence, null, 2));
