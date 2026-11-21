import { sealBatch, openBatch, type EpochKey } from '@qorechain/qoreseal';
import { toBytes, toHex, hexToBytes } from 'viem';
import { z } from 'zod';
import { canonical, hashRecord, hex32, BookError } from './codec.js';
import { signatureSchema, signHash, requireSignature, type SigningKeys } from './signing.js';
export const sealedRecordSchema = z
  .object({
    blob: z
      .string()
      .regex(/^0x[\da-fA-F]+$/)
      .transform((value) => value as `0x${string}`),
    sha3: hex32,
  })
  .strict();
export type SealedRecord = z.infer<typeof sealedRecordSchema>;
export function sealRecord(record: unknown, key: EpochKey, keys: SigningKeys, context: string): SealedRecord {
  const sha3 = hashRecord(record);
  const data = toBytes(canonical({ record, signature: signHash(sha3, keys) }));
  return { sha3, blob: toHex(sealBatch({ epochKey: key, context, batchIndex: 0, data }).blob) };
}
export function openRecord<T>(
  sealed: SealedRecord,
  key: EpochKey,
  context: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  signer: string,
  pqPublicKey: Uint8Array,
): T {
  const batch = openBatch({ blob: hexToBytes(sealed.blob), keys: [key] });
  if (batch.context !== context || batch.batchIndex !== 0n) throw new BookError('TAMPERED');
  const raw: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(batch.data));
  const signed = z.object({ record: z.unknown(), signature: signatureSchema }).strict().parse(raw);
  const record = schema.parse(signed.record);
  if (hashRecord(record) !== sealed.sha3) throw new BookError('TAMPERED');
  requireSignature(sealed.sha3, signed.signature, signer, pqPublicKey);
  return record;
}
