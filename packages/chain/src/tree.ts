import { createTreeSync, type SyncedTree } from '@gloamtrade/sdk';
import type { Abi, PublicClient } from 'viem';
import type { ChainConfig } from './config.js';

export function pinnedReader(client: PublicClient, block: bigint): PublicClient {
  return Object.assign({}, client, {
    getBlockNumber: async () => block,
    readContract: ((parameters: Parameters<PublicClient['readContract']>[0]) =>
      client.readContract({ ...parameters, blockNumber: block })) as PublicClient['readContract'],
  });
}
export async function syncPoolTree(client: PublicClient, config: ChainConfig, abi: Abi, block: bigint) {
  const reader = pinnedReader(client, block);
  const sync = createTreeSync(reader, {
    pool: config.pool, fromBlock: config.deployBlock, chunkSize: config.chunkSize,
    concurrency: 1, verifyRoot: false,
  });
  const tree = await sync.sync();
  const currentRoot = await reader.readContract({ address: config.pool, abi, functionName: 'currentRoot' });
  if (typeof currentRoot !== 'string' || tree.root.toLowerCase() !== currentRoot.toLowerCase()) {
    throw new Error('TREE_ROOT_MISMATCH');
  }
  return { tree, block, logRange: sync.logRange };
}
export async function requireNotePath(tree: SyncedTree, commitment: `0x${string}`) {
  const path = await tree.pathForCommitment(commitment);
  if (!path) throw new Error('NOTE_NOT_IN_TREE');
  return path;
}
