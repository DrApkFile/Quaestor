import { encodeFunctionData, parseAbiItem, toHex, type Abi, type Address, type Hex, type PublicClient } from 'viem';
import { z } from 'zod';
import { hashBytes } from '@quaestor/core';
import type { Journal } from './journal.js';
import type { Gateway } from './executor.js';
import { executeOperation } from './executor.js';
import { hexSchema } from './config.js';
import { assertPublishable, blobKindId, type BlobKind } from './blobPayload.js';
export const blobEvent = parseAbiItem(
  'event Blob(bytes32 indexed kind, bytes32 indexed sha3, address indexed poster, bytes data)',
);
export interface BlobBoardConfig {
  address: Address;
  deployBlock: bigint;
  chunkSize: bigint;
}
export const blobLogSchema = z
  .object({ kind: hexSchema, sha3: hexSchema, poster: z.string().regex(/^0x[\da-fA-F]{40}$/), data: hexSchema })
  .strict();
export async function postBlob(
  journal: Journal,
  id: string,
  board: Address,
  kind: BlobKind,
  bytes: Uint8Array,
  abi: Abi,
  gateway: Gateway,
) {
  assertPublishable(kind, bytes);
  const sha3 = hashBytes(bytes);
  return executeOperation(
    journal,
    {
      id,
      input: null,
      requestKey: JSON.stringify([board, kind, sha3]),
      build: () =>
        Promise.resolve({
          data: encodeFunctionData({ abi, functionName: 'post', args: [blobKindId(kind), sha3, toHex(bytes)] }),
          valueWei: '0',
          outputs: [],
          root: null,
          nullifier: null,
          feeWei: '0',
        }),
    },
    gateway,
  );
}
export async function scanBlobs(
  client: PublicClient,
  board: BlobBoardConfig,
  block: bigint,
  filter: { sha3?: Hex; kind?: Hex } = {},
) {
  if (board.chunkSize <= 0n || block < board.deployBlock) throw new Error('BLOB_RANGE_INVALID');
  const rows = [];
  for (let from = board.deployBlock; from <= block; from += board.chunkSize) {
    const end = from + board.chunkSize - 1n;
    const logs = await client.getLogs({
      address: board.address,
      event: blobEvent,
      args: filter,
      fromBlock: from,
      toBlock: end > block ? block : end,
      strict: true,
    });
    for (const log of logs) {
      if (log.removed || log.blockNumber < from || log.blockNumber > block) throw new Error('BLOB_LOG_INVALID');
      const args = blobLogSchema.parse(log.args);
      rows.push({ ...args, block: log.blockNumber, transactionHash: log.transactionHash });
    }
  }
  return rows;
}
export type FetchBlobResult =
  | { kind: 'FOUND'; bytes: Uint8Array; sha3: Hex; block: bigint; transactionHash: Hex }
  | { kind: 'BLOB_UNAVAILABLE'; reason: 'NOT_POSTED' | 'NETWORK_UNAVAILABLE' }
  | { kind: 'TAMPERED' };
export async function fetchBlob(
  client: PublicClient,
  board: BlobBoardConfig,
  sha3: Hex,
  block: bigint,
  expectedKind?: BlobKind,
): Promise<FetchBlobResult> {
  let logs;
  try {
    logs = await scanBlobs(client, board, block, { sha3, ...(expectedKind ? { kind: blobKindId(expectedKind) } : {}) });
  } catch {
    return { kind: 'BLOB_UNAVAILABLE', reason: 'NETWORK_UNAVAILABLE' };
  }
  for (const log of logs) {
    const bytes = toBytes(log.data);
    if (hashBytes(bytes) === sha3)
      return { kind: 'FOUND', bytes, sha3, block: log.block, transactionHash: log.transactionHash };
  }
  return logs.length > 0 ? { kind: 'TAMPERED' } : { kind: 'BLOB_UNAVAILABLE', reason: 'NOT_POSTED' };
}
import { toBytes } from 'viem';
