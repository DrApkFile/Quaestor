import { createTreeSync, type SyncedTree } from '@gloamtrade/sdk';
import type { Abi, PublicClient } from 'viem';
import type { ChainConfig } from './config.js';
export function pinnedReader(client: PublicClient, block: bigint): PublicClient {
  return Object.assign({}, client, {
    getBlockNumber: () => Promise.resolve().then(() => block),
    readContract: ((parameters: Parameters<PublicClient['readContract']>[0]) =>
      client.readContract({ ...parameters, blockNumber: block })) as PublicClient['readContract'],
  });
}
export async function syncPoolTree(client: PublicClient, config: ChainConfig, abi: Abi, block: bigint) {
  const reader = pinnedReader(client, block);
  const sync = createTreeSync(reader, {
    pool: config.pool,
    fromBlock: config.deployBlock,
    chunkSize: config.chunkSize,
    concurrency: 1,
    verifyRoot: false,
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

export function createPoolTreeSync(client: PublicClient, config: ChainConfig, abi: Abi) {
  let height = config.deployBlock;
  let last: bigint | null = null;
  const pinned = Object.assign({}, client, {
    getBlockNumber: () => Promise.resolve(height),
    readContract: ((parameters: Parameters<PublicClient['readContract']>[0]) =>
      client.readContract({ ...parameters, blockNumber: height })) as PublicClient['readContract'],
  });
  const make = () =>
    createTreeSync(pinned, {
      pool: config.pool,
      fromBlock: config.deployBlock,
      chunkSize: config.chunkSize,
      concurrency: 1,
      verifyRoot: false,
    });
  let sync = make();
  let queue: Promise<unknown> = Promise.resolve();
  return (block: bigint) => {
    const work = queue.then(async () => {
      if (last !== null && block < last) sync = make();
      height = block;
      const tree = await sync.sync();
      const root: unknown = await pinned.readContract({ address: config.pool, abi, functionName: 'currentRoot' });
      if (typeof root !== 'string' || root.toLowerCase() !== tree.root.toLowerCase())
        throw new Error('TREE_ROOT_MISMATCH');
      last = block;
      return { tree, block, logRange: sync.logRange };
    });
    queue = work.catch(() => undefined);
    return work;
  };
}
