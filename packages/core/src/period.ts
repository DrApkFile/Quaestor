import {
  encodeEpochKey,
  decodeEpochKey,
  seal,
  open,
  parseEnvelope,
  type EpochKey,
  type SealKeyPair,
  type SealRecipient,
} from '@qorechain/qoreseal';
import { toHex, toBytes, hexToBytes, type Hex, type Address, encodePacked, keccak256 } from 'viem';
import { z } from 'zod';
import { BookError, hex32, periodId, hashBytes, hashRecord, contractPeriod } from './codec.js';
import { signHash, requireSignature, signatureSchema, type SigningKeys } from './signing.js';
import { requireEntryChain, type EntryArtifact } from './entry.js';

export interface Period {
  book: Hex;
  periodId: string;
}
export function periodKey(ordinal: bigint, random: Uint8Array): EpochKey {
  if (ordinal < 1n || random.length !== 32) throw new BookError('INVALID_RECORD');
  return { epoch: ordinal, key: Uint8Array.from(random) };
}
export const grantRecordSchema = z
  .object({
    v: z.literal(1),
    book: hex32,
    period: periodId,
    auditor: z.string().startsWith('qor1'),
    envelopeSha3: hex32,
    issuedAt: z.string().datetime(),
  })
  .strict();
export const grantSchema = z
  .object({
    record: grantRecordSchema,
    envelope: z
      .string()
      .regex(/^0x[\da-fA-F]+$/)
      .transform((value) => value as Hex),
    signature: signatureSchema,
  })
  .strict();
export type Grant = z.infer<typeof grantSchema>;
export function grantPeriod(
  book: Hex,
  period: string,
  auditor: string,
  key: EpochKey,
  recipient: SealRecipient,
  issuedAt: string,
  signer: SigningKeys,
): Grant {
  const envelope = seal({
    chainId: 'qorechain-diana',
    purpose: `quaestor:${book}:period-key`,
    mode: 'hybrid',
    anonymous: true,
    recipients: [recipient],
    plaintext: encodeEpochKey(key),
    aad: toBytes(`${book}|${period}|${auditor}`),
  });
  const record = grantRecordSchema.parse({ v: 1, book, period, auditor, envelopeSha3: hashBytes(envelope), issuedAt });
  return { record, envelope: toHex(envelope), signature: signHash(hashRecord(record), signer) };
}
export function openGrant(
  grant: Grant,
  book: Hex,
  period: string,
  auditor: string,
  keys: SealKeyPair,
  signer: string,
  pqPublicKey: Uint8Array,
): EpochKey {
  if (grant.record.book !== book || grant.record.period !== period || grant.record.auditor !== auditor)
    throw new BookError('NOT_GRANTED');
  requireSignature(hashRecord(grant.record), grant.signature, signer, pqPublicKey);
  const envelope = hexToBytes(grant.envelope);
  if (hashBytes(envelope) !== grant.record.envelopeSha3) throw new BookError('TAMPERED');
  try {
    const header = parseEnvelope(envelope);
    if (header.mode !== 'hybrid' || !header.anonymous || header.entries.length !== 1)
      throw new BookError('NOT_GRANTED');
    return decodeEpochKey(
      open({
        chainId: 'qorechain-diana',
        purpose: `quaestor:${book}:period-key`,
        envelope,
        keys,
        aad: toBytes(`${book}|${period}|${auditor}`),
      }),
    );
  } catch {
    throw new BookError('NOT_GRANTED');
  }
}
export const closeSchema = z
  .object({
    v: z.literal(1),
    book: hex32,
    period: periodId,
    entryCount: z.number().int().nonnegative(),
    lastEntrySha3: hex32,
  })
  .strict();
export function closeRecord(book: Hex, period: string, entries: readonly EntryArtifact[], anchored: number) {
  if (anchored !== entries.length) throw new BookError('UNANCHORED');
  requireEntryChain(entries, anchored);
  const last = entries.at(-1);
  if (!last) throw new BookError('INVALID_RECORD');
  return closeSchema.parse({ v: 1, book, period, entryCount: entries.length, lastEntrySha3: last.blobSha3 });
}
export const closeDigest = (book: Hex, period: string, closeSha3: Hex, chainId: bigint, contract: Address): Hex =>
  keccak256(
    encodePacked(
      ['string', 'uint256', 'address', 'bytes32', 'bytes32', 'bytes32'],
      ['quaestor:close', chainId, contract, book, contractPeriod(period), closeSha3],
    ),
  );

export const closeDigestV2 = (
  book: Hex,
  period: string,
  entryCount: number,
  lastEntrySha3: Hex,
  closeSha3: Hex,
  chainId: bigint,
  contract: Address,
): Hex =>
  keccak256(
    encodePacked(
      ['string', 'uint256', 'address', 'bytes32', 'bytes32', 'uint64', 'bytes32', 'bytes32'],
      ['quaestor:close', chainId, contract, book, contractPeriod(period), BigInt(entryCount), lastEntrySha3, closeSha3],
    ),
  );
