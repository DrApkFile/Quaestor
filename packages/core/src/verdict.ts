import type { EpochKey } from '@qorechain/qoreseal';
import { readReceiptSignals } from '@gloamtrade/sdk';
import { hexToBytes, type Hex, type Address } from 'viem';
import { BookError, hashBytes } from './codec.js';
import { decryptEntry, receiptContext, type EntryArtifact } from './entry.js';
import { requireSignature } from './signing.js';
import { verifyProof } from './proof.js';

export type EntryVerdict =
  | { kind: 'UNKNOWN'; reason: 'MISSING_INPUTS' | 'NOT_GRANTED' }
  | { kind: 'TAMPERED'; reason: 'ANCHOR_MISMATCH' | 'BAD_SIGNATURE' | 'BROKEN_CHAIN' | 'METADATA_MISMATCH' }
  | { kind: 'UNBACKED'; reason: 'WRONG_CONTEXT' | 'BAD_PROOF' | 'MISMATCH' | 'UNKNOWN_ROOT' }
  | { kind: 'MATCHED'; reason: 'VERIFIED' };
export interface EntryAnchor {
  book: Hex;
  period: string;
  index: number;
  blobSha3: Hex;
  prevSha3: Hex;
}
export interface VerdictInput {
  artifact: EntryArtifact | null;
  anchor: EntryAnchor | null;
  key: EpochKey | null;
  signer: string | null;
  pqPublicKey: Uint8Array | null;
  expectedPrevSha3: Hex | null;
  pool: Address;
  receiptVkey: unknown;
  roots: ReadonlySet<string> | null;
}
async function evaluate(input: VerdictInput, contextCheck: boolean, rootCheck: boolean): Promise<EntryVerdict> {
  const { artifact, anchor, key, signer, pqPublicKey, expectedPrevSha3, pool, receiptVkey, roots } = input;
  if (!artifact || !anchor || !key || !signer || !pqPublicKey || expectedPrevSha3 === null || !receiptVkey || !roots)
    return { kind: 'UNKNOWN', reason: 'MISSING_INPUTS' };
  if (hashBytes(hexToBytes(artifact.blob)) !== anchor.blobSha3 || artifact.blobSha3 !== anchor.blobSha3)
    return { kind: 'TAMPERED', reason: 'ANCHOR_MISMATCH' };
  try {
    requireSignature(artifact.blobSha3, artifact.signature, signer, pqPublicKey);
  } catch {
    return { kind: 'TAMPERED', reason: 'BAD_SIGNATURE' };
  }
  if (artifact.prevEntrySha3 !== expectedPrevSha3 || anchor.prevSha3 !== expectedPrevSha3)
    return { kind: 'TAMPERED', reason: 'BROKEN_CHAIN' };
  if (artifact.book !== anchor.book || artifact.period !== anchor.period || artifact.index !== anchor.index)
    return { kind: 'TAMPERED', reason: 'METADATA_MISMATCH' };
  let entry;
  try {
    entry = decryptEntry(artifact, key);
  } catch (error: unknown) {
    return error instanceof BookError && error.code === 'NOT_GRANTED'
      ? { kind: 'UNKNOWN', reason: 'NOT_GRANTED' }
      : { kind: 'TAMPERED', reason: 'METADATA_MISMATCH' };
  }
  const signals = readReceiptSignals(entry.receipt.publicSignals);
  if (contextCheck && signals.context !== receiptContext(entry.book, entry.period, entry.index, pool))
    return { kind: 'UNBACKED', reason: 'WRONG_CONTEXT' };
  try {
    if (!(await verifyProof(receiptVkey, entry.receipt))) return { kind: 'UNBACKED', reason: 'BAD_PROOF' };
  } catch {
    return { kind: 'UNBACKED', reason: 'BAD_PROOF' };
  }
  if (
    signals.commitment !== BigInt(entry.paymentCommitment) ||
    signals.shownAmount !== BigInt(entry.amount) ||
    signals.reveal !== 1n ||
    signals.asset !== BigInt(entry.asset)
  )
    return { kind: 'UNBACKED', reason: 'MISMATCH' };
  if (rootCheck && !roots.has(signals.root.toString())) return { kind: 'UNBACKED', reason: 'UNKNOWN_ROOT' };
  return { kind: 'MATCHED', reason: 'VERIFIED' };
}
export const entryVerdict = (input: VerdictInput): Promise<EntryVerdict> => evaluate(input, true, true);
export const ablateEntry = (input: VerdictInput, omitted: 'CONTEXT' | 'ROOT_HISTORY'): Promise<EntryVerdict> =>
  evaluate(input, omitted !== 'CONTEXT', omitted !== 'ROOT_HISTORY');
