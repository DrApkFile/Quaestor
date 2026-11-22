import { sealBatch, openBatch, isQoreSealError, type OpenedBatch, type EpochKey } from '@qorechain/qoreseal';
import { proofContext } from '@gloamtrade/sdk';
import { toBytes, toHex, hexToBytes, type Hex, type Address } from 'viem';
import { z } from 'zod';
import { address, hex32, uint, periodId, canonical, hashBytes, BookError } from './codec.js';
import { signatureSchema, signHash, requireSignature, type SigningKeys } from './signing.js';

const decimal = z.string().regex(/^\d+$/);
export const receiptSchema = z
  .object({
    proof: z
      .object({
        pi_a: z.array(decimal),
        pi_b: z.array(z.array(decimal)),
        pi_c: z.array(decimal),
        protocol: z.literal('groth16').optional(),
        curve: z.literal('bn128').optional(),
      })
      .strict(),
    publicSignals: z.array(decimal).length(7),
  })
  .strict();
export const entrySchema = z
  .object({
    v: z.literal(1),
    book: hex32,
    period: periodId,
    index: z.number().int().nonnegative().safe(),
    prevEntrySha3: hex32,
    date: z.string().datetime().optional(),
    direction: z.enum(['IN', 'OUT']),
    asset: address,
    amount: uint,
    paymentCommitment: hex32,
    counterparty: z.object({ address: z.string().startsWith('qor1'), name: z.string().min(1) }).strict(),
    purpose: z.string(),
    category: z.string(),
    notes: z.string(),
    receipt: receiptSchema,
    invoice: z
      .object({ sha3: hex32, bytes: z.number().int().min(1).max(20480) })
      .strict()
      .optional(),
  })
  .strict();
export type Entry = z.infer<typeof entrySchema>;
export const artifactSchema = z
  .object({
    book: hex32,
    period: periodId,
    index: z.number().int().nonnegative(),
    prevEntrySha3: hex32,
    blob: z
      .string()
      .regex(/^0x[\da-fA-F]+$/)
      .transform((value) => value as Hex),
    blobSha3: hex32,
    signature: signatureSchema,
  })
  .strict();
export type EntryArtifact = z.infer<typeof artifactSchema>;
export const receiptContext = (book: Hex, period: string, index: number, pool: Address): bigint =>
  proofContext({
    kind: 'payment',
    chainId: 9800,
    pool,
    verifier: `quaestor|${book}|${period}|${String(index)}`,
    expiresAt: 0,
  });
export function requireReceiptContext(entry: Entry, pool: Address): void {
  if (entry.receipt.publicSignals[6] !== receiptContext(entry.book, entry.period, entry.index, pool).toString())
    throw new BookError('WRONG_CONTEXT');
}
export function sealEntry(input: unknown, key: EpochKey, keys: SigningKeys, pool: Address): EntryArtifact {
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) throw new BookError('INVALID_RECORD');
  const entry = parsed.data;
  requireReceiptContext(entry, pool);
  const sealed = sealBatch({
    epochKey: key,
    context: `quaestor:${entry.book}:entry`,
    batchIndex: entry.index,
    data: toBytes(canonical(entry)),
  });
  const hash = hashBytes(sealed.blob);
  return {
    book: entry.book,
    period: entry.period,
    index: entry.index,
    prevEntrySha3: entry.prevEntrySha3,
    blob: toHex(sealed.blob),
    blobSha3: hash,
    signature: signHash(hash, keys),
  };
}
export function verifyArtifact(artifact: EntryArtifact, anchor: Hex, signer: string, pqPublicKey: Uint8Array): void {
  const digest = hashBytes(hexToBytes(artifact.blob));
  if (digest !== anchor || digest !== artifact.blobSha3) throw new BookError('TAMPERED');
  requireSignature(digest, artifact.signature, signer, pqPublicKey);
}
export function decryptEntry(artifact: EntryArtifact, key: EpochKey): Entry {
  let batch: OpenedBatch;
  try {
    batch = openBatch({ blob: hexToBytes(artifact.blob), keys: [key] });
  } catch (error: unknown) {
    if (isQoreSealError(error) && (error.code === 'DECRYPTION_FAILED' || error.code === 'UNKNOWN_EPOCH'))
      throw new BookError('NOT_GRANTED');
    throw new BookError('TAMPERED');
  }
  if (batch.context !== `quaestor:${artifact.book}:entry` || batch.batchIndex !== BigInt(artifact.index))
    throw new BookError('TAMPERED');
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(batch.data)) as unknown;
  } catch {
    throw new BookError('TAMPERED');
  }
  const parsed = entrySchema.safeParse(raw);
  if (!parsed.success) throw new BookError('TAMPERED');
  const entry = parsed.data;
  if (
    entry.book !== artifact.book ||
    entry.period !== artifact.period ||
    entry.index !== artifact.index ||
    entry.prevEntrySha3 !== artifact.prevEntrySha3
  )
    throw new BookError('TAMPERED');
  return entry;
}
export function requireEntryChain(entries: readonly EntryArtifact[], expectedCount: number): void {
  if (entries.length !== expectedCount) throw new BookError('CHAIN_BROKEN');
  let previous: Hex = `0x${'00'.repeat(32)}`;
  for (const [index, entry] of entries.entries()) {
    if (entry.index !== index || entry.prevEntrySha3 !== previous) throw new BookError('CHAIN_BROKEN');
    previous = entry.blobSha3;
  }
}

export function openEntry(artifact: EntryArtifact, key: EpochKey, pool: Address): Entry {
  const entry = decryptEntry(artifact, key);
  requireReceiptContext(entry, pool);
  return entry;
}
