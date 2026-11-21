import { IncrementalMerkleTreePoseidon, noteCommitmentPoseidon, buildFundsWitness } from '@gloamtrade/sdk';
import { randomBytes } from 'node:crypto';
import { groth16 } from 'snarkjs';
import { toHex, zeroAddress } from 'viem';
import { fundsSchema, verifyProof, holdingsContext } from '@quaestor/core';
import { m2Root } from './m2Context.js';
import { readJson } from './m3Shared.js';
import { writePrivateJson } from '../src/storage.js';
const secret = toHex(randomBytes(31));
const tree = new IncrementalMerkleTreePoseidon();
await tree.init();
await tree.insert(await noteCommitmentPoseidon(BigInt(secret), 3n, zeroAddress));
const context = holdingsContext(`0x${'11'.repeat(32)}`, '2026-11-21', zeroAddress);
const witness = await buildFundsWitness({
  asset: zeroAddress,
  threshold: 3n,
  context,
  notes: [{ secretHex: secret, amount: 3n, path: await tree.path(0) }],
});
if (witness.blocker) throw new Error('FUNDS_WITNESS_BLOCKED');
const base = `${m2Root}/apps/web/public/circuits`;
const proof = fundsSchema.parse(
  await groth16.fullProve(witness.circomInput, `${base}/funds.wasm`, `${base}/funds_final.zkey`, undefined, undefined, {
    singleThread: true,
  }),
);
const vkey = readJson(`${base}/funds_vkey.json`);
const accepted = await verifyProof(vkey, proof);
const changed = structuredClone(proof);
changed.publicSignals[2] = '4';
const rejected = !(await verifyProof(vkey, changed));
const evidence = {
  command: 'pnpm evidence --m4-proof-spike',
  at: new Date().toISOString(),
  label: 'offline synthetic funds witness; not a live holding',
  accepted,
  changedThresholdRejected: rejected,
  signalCount: proof.publicSignals.length,
  slots: 4,
  publicSignalOrder: ['root', 'asset', 'threshold', 'context', 'nullifier0', 'nullifier1', 'nullifier2', 'nullifier3'],
};
if (!accepted || !rejected) throw new Error('FUNDS_SPIKE_FAILED');
writePrivateJson(`${m2Root}/evidence/m4-funds-spike.json`, evidence);
console.log(JSON.stringify(evidence, null, 2));
