import { open, isQoreSealError } from '@qorechain/qoreseal';
import { hexToBytes, toBytes } from 'viem';
import { contractPeriod, hashRecord, hashBytes, requireSignature } from '@quaestor/core';
import { m2Context, m2Root } from './m2Context.js';
import { m4Public } from './m4State.js';
import { readJson } from './m3Shared.js';
import { m4ManifestSchema } from './m4Manifest.js';
import { auditBookM4 } from './m4AuditBook.js';
import { parseAddress } from '@qorechain/qoresign';
import { readRegistry } from '../src/tickets/kemRegistry.js';
import { loadPoolAbi } from '../src/abi.js';
export async function auditM4() {
  const context = await m2Context('auditor', 'm4-auditor');
  const manifest = m4ManifestSchema.parse(readJson(`${m4Public}/manifest.json`));
  const block = await context.reader.getBlockNumber({ cacheTime: 0 });
  const abi = loadPoolAbi(`${m2Root}/contracts/out/Books.sol/Books.json`);
  const honest = await auditBookM4(context, manifest, 'honest', abi, block);
  const attack = await auditBookM4(context, manifest, 'attack', abi, block);
  const anchor: unknown = await context.reader.readContract({
    address: manifest.contract,
    abi,
    functionName: 'grants',
    args: [manifest.honest.book, contractPeriod(manifest.periodB), context.account.evm],
    blockNumber: block,
  });
  if (anchor !== `0x${'00'.repeat(32)}` || manifest.honest.selfB.record.book !== manifest.honest.book)
    throw new Error('PERIOD_B_GRANTED');
  const state: unknown = await context.reader.readContract({
    address: manifest.contract,
    abi,
    functionName: 'entryAnchors',
    args: [manifest.honest.book, contractPeriod(manifest.periodB), 0n],
    blockNumber: block,
  });
  if (!Array.isArray(state) || state[0] !== manifest.honest.entryB.blobSha3) throw new Error('PERIOD_B_ENTRY_MISSING');
  const self = manifest.honest.selfB;
  const ownerAnchor: unknown = await context.reader.readContract({
    address: manifest.contract,
    abi,
    functionName: 'grants',
    args: [manifest.honest.book, contractPeriod(manifest.periodB), parseAddress(manifest.business).hex],
    blockNumber: block,
  });
  if (
    ownerAnchor !== hashRecord(self) ||
    self.record.period !== manifest.periodB ||
    self.record.auditor !== manifest.business ||
    hashBytes(hexToBytes(self.envelope)) !== self.record.envelopeSha3
  )
    throw new Error('PERIOD_B_SELF_COPY_MISMATCH');
  const registry = await readRegistry(context.config, manifest.business, block);
  requireSignature(hashRecord(self.record), self.signature, manifest.business, registry.pqPublicKey);
  let refused = false;
  try {
    open({
      chainId: 'qorechain-diana',
      purpose: `quaestor:${manifest.honest.book}:period-key`,
      keys: context.sealKeys,
      envelope: hexToBytes(manifest.honest.selfB.envelope),
      aad: toBytes(`${manifest.honest.book}|${manifest.periodB}|${manifest.business}`),
    });
  } catch (error: unknown) {
    if (isQoreSealError(error) && error.code === 'DECRYPTION_FAILED') refused = true;
    else throw error;
  }
  if (!refused) throw new Error('PERIOD_B_OPENED');
  return {
    pid: process.pid,
    loadedAccounts: ['auditor'],
    auditBlock: block.toString(),
    honest,
    attack,
    periodB: {
      kind: 'UNKNOWN',
      reason: 'NOT_GRANTED',
      grantAbsent: true,
      hasEntry: true,
      cryptoRefusal: 'DECRYPTION_FAILED',
    },
    grantHash: hashRecord(manifest.honest.grant),
  };
}
