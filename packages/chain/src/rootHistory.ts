import { insertionRoots } from '@quaestor/core';
import type { Abi, PublicClient } from 'viem';
import type { ChainConfig } from './config.js';
import { syncPoolTree } from './tree.js';
export async function fullRootHistory(client: PublicClient, config: ChainConfig, abi: Abi, block: bigint) {
  const snapshot = await syncPoolTree(client, config, abi, block);
  for (const [index, leaf] of snapshot.tree.leaves.entries())
    if (leaf.leafIndex !== index) throw new Error('LEAF_ORDER_INVALID');
  const roots = await insertionRoots(snapshot.tree.leaves.map((leaf) => leaf.commitment));
  if (!roots.has(BigInt(snapshot.tree.root).toString())) throw new Error('HISTORY_ROOT_MISMATCH');
  return { ...snapshot, roots };
}
