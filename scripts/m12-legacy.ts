import { readdirSync } from 'node:fs';
import { z } from 'zod';
import { IQORE_PQC_ABI } from '@qorechain/evm';
import { pqcSign } from '@qorechain/sdk';
import { toHex, hexToBytes, decodeFunctionData, encodePacked, keccak256 } from 'viem';
import {
  artifactSchema,
  grantSchema,
  verifyArtifact,
  requireSignature,
  hashRecord,
} from '../packages/core/src/index.js';
import { type M2Context, m2Root } from '../packages/chain/scripts/m2Context.js';
import { readJson } from '../packages/chain/scripts/m3Shared.js';
import { loadPoolAbi } from '../packages/chain/src/abi.js';
import { hexSchema } from '../packages/chain/src/config.js';
export async function legacyChecks(context: M2Context, publicKey: Uint8Array, block: bigint) {
  const directory = `${m2Root}/.accounts/m4-live/ciphertexts`;
  let entries = 0,
    grants = 0;
  for (const file of readdirSync(directory).filter((name) => name.startsWith('honest-') && name.endsWith('.json'))) {
    const raw = readJson(`${directory}/${file}`),
      entry = artifactSchema.safeParse(raw),
      grant = grantSchema.safeParse(raw);
    if (entry.success) {
      verifyArtifact(entry.data, entry.data.blobSha3, context.account.cosmos, publicKey);
      entries++;
    } else if (grant.success) {
      requireSignature(hashRecord(grant.data.record), grant.data.signature, context.account.cosmos, publicKey);
      grants++;
    }
  }
  if (entries === 0 || grants === 0) throw new Error('LEGACY_RECORDS_REQUIRED');
  const historical = z
    .object({ receipt: z.object({ transactionHash: hexSchema }).passthrough() })
    .passthrough()
    .parse(readJson(`${m2Root}/evidence/m11-pq-gas.json`));
  const tx = await context.reader.getTransaction({ hash: historical.receipt.transactionHash });
  const abi = loadPoolAbi(`${m2Root}/contracts/out/Books.sol/Books.json`);
  const decoded = decodeFunctionData({ abi, data: tx.input });
  if (decoded.functionName !== 'closePeriod' || !tx.to) throw new Error('LEGACY_CLOSE_REQUIRED');
  const args = z.tuple([hexSchema, hexSchema, z.bigint(), hexSchema, hexSchema, hexSchema]).parse(decoded.args);
  const digest = keccak256(
    encodePacked(
      ['string', 'uint256', 'address', 'bytes32', 'bytes32', 'uint64', 'bytes32', 'bytes32'],
      ['quaestor:close', 9800n, tx.to, args[0], args[1], args[2], args[3], args[4]],
    ),
  );
  const deterministicMatches = toHex(pqcSign(context.account.pqc.secretKey, hexToBytes(digest))) === args[5];
  const accepted = await context.reader.readContract({
    address: '0x0000000000000000000000000000000000000a01',
    abi: IQORE_PQC_ABI,
    functionName: 'pqcVerify',
    args: [toHex(publicKey), args[5], digest],
    blockNumber: block,
  });
  if (!deterministicMatches || !accepted) throw new Error('LEGACY_VERIFICATION_FAILED');
  return {
    source: '.accounts/m4-live/ciphertexts (existing signed ciphertext records)',
    entriesVerified: entries,
    grantsVerified: grants,
    closeTransaction: tx.hash,
    deterministicMatches,
    pinnedBlock: block.toString(),
    deterministicCloseAccepted: accepted,
  };
}
