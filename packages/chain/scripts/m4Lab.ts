import { IncrementalMerkleTreePoseidon, buildReceiptWitness } from '@gloamtrade/sdk';
import { sealBatch, type EpochKey } from '@qorechain/qoreseal';
import { groth16 } from 'snarkjs';
import { toHex, toBytes, type Hex } from 'viem';
import {
  canonical,
  hashBytes,
  signHash,
  receiptSchema,
  receiptContext,
  entryVerdict,
  ablateEntry,
  type Entry,
  type VerdictInput,
  type EntryArtifact,
} from '@quaestor/core';
import { m2Root, type M2Context } from './m2Context.js';
import { signingKeys, readJson, artifact } from './m3Shared.js';
import { m4Public } from './m4State.js';
import { artifactSchema } from '@quaestor/core';
import type { StoredNote } from '../src/journal.js';
export function rawLabEntry(context: M2Context, entry: Entry, key: EpochKey, label: string) {
  return artifact(`${m4Public}/${label}.json`, artifactSchema, () => {
    const blob = sealBatch({
      epochKey: key,
      context: `quaestor:${entry.book}:entry`,
      batchIndex: entry.index,
      data: toBytes(canonical(entry)),
    }).blob;
    const blobSha3 = hashBytes(blob);
    return {
      book: entry.book,
      period: entry.period,
      index: entry.index,
      prevEntrySha3: entry.prevEntrySha3,
      blob: toHex(blob),
      blobSha3,
      signature: signHash(blobSha3, signingKeys(context)),
    };
  });
}
export function localVerdictInput(
  context: M2Context,
  entry: EntryArtifact,
  key: EpochKey,
  roots: ReadonlySet<string>,
): VerdictInput {
  return {
    artifact: entry,
    anchor: {
      book: entry.book,
      period: entry.period,
      index: entry.index,
      prevSha3: entry.prevEntrySha3,
      blobSha3: entry.blobSha3,
    },
    expectedPrevSha3: entry.prevEntrySha3,
    key,
    signer: context.account.cosmos,
    pqPublicKey: context.account.pqc.publicKey,
    pool: context.config.pool,
    receiptVkey: readJson(`${m2Root}/apps/web/public/circuits/receipt_vkey.json`),
    roots,
  };
}
export async function ablationsM4(
  context: M2Context,
  reused: EntryArtifact,
  reusedKey: EpochKey,
  note: StoredNote,
  book: Hex,
  period: string,
  roots: ReadonlySet<string>,
) {
  const reuse = localVerdictInput(context, reused, reusedKey, roots);
  const tree = new IncrementalMerkleTreePoseidon();
  await tree.init();
  await tree.insert(BigInt(note.commitment));
  await tree.insert(123n);
  if (roots.has(tree.currentRoot.toString())) throw new Error('ABLATION_ROOT_NOT_NOVEL');
  const witness = await buildReceiptWitness({
    secretHex: note.secret,
    amount: BigInt(note.amountWei),
    asset: note.asset,
    path: await tree.path(0),
    reveal: true,
    context: receiptContext(book, period, 2, context.config.pool),
  });
  if (witness.blocker) throw new Error('ABLATION_WITNESS_BLOCKED');
  const base = `${m2Root}/apps/web/public/circuits`;
  const receipt = receiptSchema.parse(
    await groth16.fullProve(
      witness.circomInput,
      `${base}/receipt.wasm`,
      `${base}/receipt_final.zkey`,
      undefined,
      undefined,
      { singleThread: true },
    ),
  );
  const forged: Entry = {
    v: 1,
    book,
    period,
    index: 2,
    prevEntrySha3: reused.blobSha3,
    direction: 'IN',
    asset: note.asset,
    amount: note.amountWei,
    paymentCommitment: note.commitment,
    counterparty: { address: context.account.cosmos, name: 'Attack lab (demo)' },
    purpose: 'Synthetic-root ablation (demo)',
    category: 'attack lab',
    notes: 'Constructed input; not a chain anchor',
    receipt,
  };
  const artifact = rawLabEntry(context, forged, reusedKey, 'root-ablation');
  const input = localVerdictInput(context, artifact, reusedKey, roots);
  const output = {
    command: 'pnpm evidence --m4',
    label: 'real-proof ablations; root case uses a constructed anchor input, not an on-chain anchor',
    at: new Date().toISOString(),
    context: { without: await ablateEntry(reuse, 'CONTEXT'), with: await entryVerdict(reuse) },
    rootHistory: {
      rootWasNeverInPool: !roots.has(tree.currentRoot.toString()),
      without: await ablateEntry(input, 'ROOT_HISTORY'),
      with: await entryVerdict(input),
    },
  };
  return output;
}
