import { it, expect, vi } from 'vitest';
import { sealBatch } from '@qorechain/qoreseal';
import { hashBytes, canonical } from '@quaestor/core';
import { toHex, toBytes, zeroAddress, type PublicClient } from 'viem';
import { assertPublishable, blobKindId } from '../src/blobPayload.js';
import { fetchBlob } from '../src/blobs.js';
const bytes = sealBatch({
  epochKey: { epoch: 1n, key: new Uint8Array(32).fill(91) },
  context: `quaestor:0x${'11'.repeat(32)}:entry`,
  batchIndex: 0,
  data: toBytes('Synthetic fixture (demo)'),
}).blob;
const sha3 = hashBytes(bytes);
const tx = `0x${'22'.repeat(32)}` as const;
const board = { address: zeroAddress, deployBlock: 100n, chunkSize: 20n };
const log = (data: Uint8Array) => ({
  removed: false,
  blockNumber: 101n,
  transactionHash: tx,
  args: { kind: blobKindId('entry'), sha3, poster: zeroAddress, data: toHex(data) },
});
it('T-BLOB paged topic reads rehash bytes and ignore forged candidates when a valid copy exists', async () => {
  const getLogs = vi.fn((args: { fromBlock: bigint }) =>
    Promise.resolve(args.fromBlock === 100n ? [log(new Uint8Array([1, 2])), log(bytes)] : []),
  );
  const client = { getLogs } as unknown as PublicClient;
  expect(await fetchBlob(client, board, sha3, 145n, 'entry')).toMatchObject({ kind: 'FOUND', sha3, bytes });
  expect(getLogs).toHaveBeenCalledTimes(3);
  expect(getLogs).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ args: { sha3, kind: blobKindId('entry') }, fromBlock: 100n, toBlock: 119n }),
  );
  expect(getLogs).toHaveBeenLastCalledWith(expect.objectContaining({ fromBlock: 140n, toBlock: 145n }));
});
it('T-BLOB absent and corrupt public hash claims are unavailable and TAMPERED', async () => {
  const empty = { getLogs: () => Promise.resolve([]) } as unknown as PublicClient;
  expect(await fetchBlob(empty, board, sha3, 110n)).toEqual({ kind: 'BLOB_UNAVAILABLE', reason: 'NOT_POSTED' });
  const forged = { getLogs: () => Promise.resolve([log(new Uint8Array([1, 2]))]) } as unknown as PublicClient;
  expect(await fetchBlob(forged, board, sha3, 110n)).toEqual({ kind: 'TAMPERED' });
});
it('T-BLOB publisher refuses plaintext and secret-bearing unsigned JSON', () => {
  assertPublishable('entry', bytes);
  expect(() => {
    assertPublishable('entry', toBytes(canonical({ secret: 'synthetic-secret', amount: '1' })));
  }).toThrow('BLOB_FORMAT_INVALID');
  expect(() => {
    assertPublishable('card', toBytes(canonical({ mnemonic: 'synthetic fixture (demo)' })));
  }).toThrow('BLOB_FORMAT_INVALID');
  expect(() => {
    assertPublishable('entry', new Uint8Array(24577));
  }).toThrow('BLOB_SIZE_INVALID');
});
