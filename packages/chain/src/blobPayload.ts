import { parseBatchHeader, parseEnvelope } from '@qorechain/qoreseal';
import { artifactSchema, grantSchema, legacyMapSchema, hashBytes, canonical, hashRecord } from '@quaestor/core';
import { keccak256, toBytes, type Hex } from 'viem';
import { cardSchema } from './tickets/cardCodec.js';
export const blobKinds = ['entry', 'grant', 'close', 'opening', 'card', 'invoice', 'legacy-map'] as const;
export type BlobKind = (typeof blobKinds)[number];
export const blobKindId = (kind: BlobKind): Hex => keccak256(toBytes(`quaestor:${kind}`));
export function publicRecordBytes(value: unknown): Uint8Array {
  return toBytes(canonical(value));
}
export function assertPublishable(kind: BlobKind, bytes: Uint8Array): void {
  if (bytes.length === 0 || bytes.length > 24576) throw new Error('BLOB_SIZE_INVALID');
  const batch = (() => {
    try {
      return parseBatchHeader(bytes);
    } catch {
      return null;
    }
  })();
  if (batch && (kind === 'entry' || kind === 'opening' || kind === 'close' || kind === 'invoice')) {
    if (!batch.context.startsWith('quaestor:')) throw new Error('BLOB_FORMAT_INVALID');
    return;
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error('BLOB_FORMAT_INVALID');
  }
  if (kind === 'entry') {
    const entry = artifactSchema.safeParse(value);
    if (!entry.success) throw new Error('BLOB_FORMAT_INVALID');
    const blob = toBytes(entry.data.blob);
    parseBatchHeader(blob);
    if (hashBytes(blob) !== entry.data.blobSha3) throw new Error('TAMPERED');
    return;
  }
  if (kind === 'grant') {
    const grant = grantSchema.safeParse(value);
    if (!grant.success) throw new Error('BLOB_FORMAT_INVALID');
    const envelope = toBytes(grant.data.envelope);
    const parsed = parseEnvelope(envelope);
    if (parsed.mode !== 'hybrid' || !parsed.anonymous || hashBytes(envelope) !== grant.data.record.envelopeSha3)
      throw new Error('BLOB_FORMAT_INVALID');
    return;
  }
  if (kind === 'card') {
    if (!cardSchema.safeParse(value).success) throw new Error('BLOB_FORMAT_INVALID');
    return;
  }
  if (kind === 'legacy-map') {
    if (!legacyMapSchema.safeParse(value).success) throw new Error('BLOB_FORMAT_INVALID');
    return;
  }
  throw new Error('BLOB_FORMAT_INVALID');
}
export const publicBytesSha3 = (value: unknown): Hex => hashRecord(value);
