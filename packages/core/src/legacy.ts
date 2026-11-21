import { z } from 'zod';
import { hexToBytes, type Hex } from 'viem';
import type { EpochKey } from '@qorechain/qoreseal';
import { hex32, hashRecord, hashBytes, BookError } from './codec.js';
import { signatureSchema, signHash, requireSignature, type SigningKeys } from './signing.js';
import { openLegacyRecord } from './records.js';
export const legacyMapRecordSchema = z
  .object({ book: hex32, kind: z.enum(['opening', 'close']), anchoredSha3: hex32, ciphertextSha3: hex32 })
  .strict();
export const legacyMapSchema = z.object({ record: legacyMapRecordSchema, signature: signatureSchema }).strict();
export type LegacyMap = z.infer<typeof legacyMapSchema>;
export function signLegacyMap(record: z.infer<typeof legacyMapRecordSchema>, keys: SigningKeys): LegacyMap {
  const parsed = legacyMapRecordSchema.parse(record);
  return { record: parsed, signature: signHash(hashRecord(parsed), keys) };
}
export function verifyLegacyMap(
  input: unknown,
  book: Hex,
  kind: 'opening' | 'close',
  anchor: Hex,
  owner: string,
  pqPublicKey: Uint8Array,
): LegacyMap {
  const parsed = legacyMapSchema.safeParse(input);
  if (!parsed.success) throw new BookError('TAMPERED');
  const value = parsed.data;
  if (value.record.book !== book || value.record.kind !== kind || value.record.anchoredSha3 !== anchor)
    throw new BookError('TAMPERED');
  requireSignature(hashRecord(value.record), value.signature, owner, pqPublicKey);
  return value;
}
export function openMappedRecord<T>(
  mapping: LegacyMap,
  blob: Hex,
  key: EpochKey,
  context: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  owner: string,
  pqPublicKey: Uint8Array,
): T {
  requireSignature(hashRecord(mapping.record), mapping.signature, owner, pqPublicKey);
  if (hashBytes(hexToBytes(blob)) !== mapping.record.ciphertextSha3) throw new BookError('TAMPERED');
  return openLegacyRecord({ blob, sha3: mapping.record.anchoredSha3 }, key, context, schema, owner, pqPublicKey);
}
