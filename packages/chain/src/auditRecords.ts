import { z } from 'zod';
import type { EpochKey } from '@quaestor/core';
import {
  grantSchema,
  hashRecord,
  contractPeriod,
  openRecord,
  openMappedRecord,
  requireSignature,
} from '@quaestor/core';
import { parseAddress } from '@qorechain/qoresign';
import { ownerKey, requiredBlob, parsePublicJSON, type RecordCipher } from './blobReader.js';
import type { BookSnapshot } from './booksReader.js';
import type { AuditConfig } from './auditTypes.js';
export function decodeRecord<T>(
  ref: RecordCipher,
  key: EpochKey,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  pq: Awaited<ReturnType<typeof ownerKey>>,
): T {
  return ref.legacy
    ? openMappedRecord(ref.legacy, ref.blob, key, ref.context, schema, pq.address, pq.publicKey)
    : openRecord({ blob: ref.blob, sha3: ref.anchor }, key, ref.context, schema, pq.address, pq.publicKey);
}
export async function grantBody(context: AuditConfig, snapshot: BookSnapshot, row: BookSnapshot['grants'][number]) {
  const bytes = await requiredBlob(context, row.sha3, snapshot.block, 'grant');
  const value = grantSchema.parse(parsePublicJSON(bytes));
  if (
    hashRecord(value) !== row.sha3 ||
    value.record.book !== snapshot.book ||
    contractPeriod(value.record.period) !== row.period ||
    parseAddress(value.record.auditor).hex.toLowerCase() !== row.auditor.toLowerCase()
  )
    throw new Error('TAMPERED');
  const pq = await ownerKey(context, snapshot, snapshot.block);
  requireSignature(hashRecord(value.record), value.signature, pq.address, pq.publicKey);
  return value;
}
