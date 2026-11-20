import { fieldToBytes32, IncrementalMerkleTreePoseidon } from '@gloamtrade/sdk';
import { zeroAddress, type PublicClient } from 'viem';
import { expect, it, vi } from 'vitest';
import { syncPoolTree } from '../src/tree.js';
import type { ChainConfig } from '../src/config.js';
const config: ChainConfig = {
    chainId: 9800, nativeChainId: 'qorechain-diana', pool: zeroAddress, fusd: zeroAddress,
    evmRpc: 'https://example.invalid', consensusRpc: 'https://example.invalid', rest: 'https://example.invalid',
    deployBlock: 100n, chunkSize: 3n,
};
it('T-TREE pages every deployment block and checks only the root at the pinned height', async () => {
    const empty = new IncrementalMerkleTreePoseidon();
    await empty.init();
    const getLogs = vi.fn(() => Promise.resolve().then(() => []));
    const readContract = vi.fn(() => Promise.resolve().then(() => fieldToBytes32(empty.currentRoot)));
    const reader = { getLogs, readContract, getChainId: () => Promise.resolve().then(() => 9800) } as unknown as PublicClient;
    const synced = await syncPoolTree(reader, config, [], 107n);
    expect(synced.tree.leafCount).toBe(0);
    expect(getLogs.mock.calls).toHaveLength(3);
    expect(getLogs).toHaveBeenNthCalledWith(1, expect.objectContaining({ fromBlock: 100n, toBlock: 102n }));
    expect(getLogs).toHaveBeenNthCalledWith(2, expect.objectContaining({ fromBlock: 103n, toBlock: 105n }));
    expect(getLogs).toHaveBeenNthCalledWith(3, expect.objectContaining({ fromBlock: 106n, toBlock: 107n }));
    expect(readContract).toHaveBeenCalledTimes(1);
    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'currentRoot', blockNumber: 107n }));
}, 30000);
it('T-TREE refuses a replayed root mismatch without trusting a known-root response', async () => {
    const reader = { getLogs: () => Promise.resolve().then(() => []), readContract: vi.fn(() => Promise.resolve().then(() => `0x${'01'.repeat(32)}`)),
        getChainId: () => Promise.resolve().then(() => 9800) } as unknown as PublicClient;
    await expect(syncPoolTree(reader, config, [], 107n)).rejects.toThrow('TREE_ROOT_MISMATCH');
});
