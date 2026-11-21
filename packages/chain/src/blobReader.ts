import { toBytes, toHex, type Hex, type PublicClient } from 'viem';
import { fetchPqKeyStatus } from '@qorechain/qoresign/network';
import { parseAddress } from '@qorechain/qoresign';
import {
  artifactSchema,
  legacyMapSchema,
  verifyLegacyMap,
  hashBytes,
  contractPeriod,
  requireSignature,
  type EntryArtifact,
  type LegacyMap,
} from '@quaestor/core';
import { fetchBlob, scanBlobs, type BlobBoardConfig } from './blobs.js';
import { blobKindId, type BlobKind } from './blobPayload.js';
import { registryFetch } from './tickets/kemRegistry.js';
import type { ChainConfig } from './config.js';
import type { BookSnapshot, EntryRow } from './booksReader.js';
export interface BlobContext {
  client: PublicClient;
  board: BlobBoardConfig;
  chain: ChainConfig;
  legacyBooks: Readonly<Record<string, 'honest' | 'attack'>>;
}
export function parsePublicJSON(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    return null;
  }
}
export async function ownerKey(context: BlobContext, snapshot: BookSnapshot, block = snapshot.block) {
  const address = parseAddress(snapshot.owner).bech32;
  const status = await fetchPqKeyStatus({
    rest: context.chain.rest,
    address,
    fetch: registryFetch(context.chain, block),
  });
  if (!status.registered || status.algorithmId !== 1 || status.possessionProven !== true || !status.publicKey)
    throw new Error('PQ_POSSESSION_NOT_PROVEN');
  return { address, publicKey: status.publicKey };
}
export async function requiredBlob(context: BlobContext, sha3: Hex, block: bigint, kind: BlobKind) {
  const found = await fetchBlob(context.client, context.board, sha3, block, kind);
  if (found.kind !== 'FOUND') throw new Error(found.kind);
  return found.bytes;
}
export async function discoverJSON(context: BlobContext, kind: BlobKind, block: bigint) {
  const logs = await scanBlobs(context.client, context.board, block, { kind: blobKindId(kind) });
  const values: unknown[] = [];
  for (const log of logs) {
    const bytes = toBytes(log.data);
    if (hashBytes(bytes) !== log.sha3) continue;
    const value = parsePublicJSON(bytes);
    if (value !== null) values.push(value);
  }
  return values;
}
export async function entryArtifact(
  context: BlobContext,
  snapshot: BookSnapshot,
  row: EntryRow,
  descriptors: unknown[],
  pq: Awaited<ReturnType<typeof ownerKey>>,
): Promise<EntryArtifact> {
  const bytes = await requiredBlob(context, row.blobSha3, snapshot.block, 'entry');
  let invalid: EntryArtifact | null = null;
  for (const value of descriptors) {
    const parsed = artifactSchema.safeParse(value);
    if (!parsed.success) continue;
    const data = parsed.data;
    if (
      data.book !== snapshot.book ||
      data.index !== row.index ||
      contractPeriod(data.period) !== row.period ||
      data.blobSha3 !== row.blobSha3
    )
      continue;
    const artifact = { ...data, blob: toHex(bytes) };
    try {
      requireSignature(artifact.blobSha3, artifact.signature, pq.address, pq.publicKey);
      return artifact;
    } catch {
      invalid = artifact;
    }
  }
  if (invalid) return invalid;
  throw new Error('BLOB_UNAVAILABLE');
}
export interface RecordCipher {
  blob: Hex;
  anchor: Hex;
  ciphertextSha3: Hex;
  legacy: LegacyMap | null;
  context: string;
}
export async function recordCipher(
  context: BlobContext,
  snapshot: BookSnapshot,
  kind: 'opening' | 'close',
  anchor: Hex,
  pq: Awaited<ReturnType<typeof ownerKey>>,
): Promise<RecordCipher> {
  const label = context.legacyBooks[snapshot.book];
  if (!label) {
    const bytes = await requiredBlob(context, anchor, snapshot.block, kind);
    return {
      blob: toHex(bytes),
      anchor,
      ciphertextSha3: anchor,
      legacy: null,
      context: `quaestor:${snapshot.book}:${kind}`,
    };
  }
  const values = await discoverJSON(context, 'legacy-map', snapshot.block);
  let bad = false;
  let unavailable = false;
  for (const value of values) {
    const parsed = legacyMapSchema.safeParse(value);
    if (
      !parsed.success ||
      parsed.data.record.book !== snapshot.book ||
      parsed.data.record.kind !== kind ||
      parsed.data.record.anchoredSha3 !== anchor
    )
      continue;
    try {
      const mapping = verifyLegacyMap(value, snapshot.book, kind, anchor, pq.address, pq.publicKey);
      const bytes = await requiredBlob(context, mapping.record.ciphertextSha3, snapshot.block, kind);
      return {
        blob: toHex(bytes),
        anchor,
        ciphertextSha3: mapping.record.ciphertextSha3,
        legacy: mapping,
        context: `quaestor:${snapshot.book}:${label}-${kind}`,
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'BLOB_UNAVAILABLE') unavailable = true;
      else bad = true;
    }
  }
  throw new Error(bad && !unavailable ? 'TAMPERED' : 'BLOB_UNAVAILABLE');
}
