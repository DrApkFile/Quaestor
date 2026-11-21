import { IncrementalMerkleTreePoseidon } from '@gloamtrade/sdk';
import type { Hex } from 'viem';
export async function insertionRoots(leaves: readonly Hex[]): Promise<ReadonlySet<string>> {
  const tree = new IncrementalMerkleTreePoseidon();
  await tree.init();
  const roots = new Set<string>();
  for (const leaf of leaves) {
    await tree.insert(BigInt(leaf));
    roots.add(tree.currentRoot.toString());
  }
  return roots;
}
