import { z } from 'zod';
import { toHex, type Abi } from 'viem';
import { parseAddress } from '@qorechain/qoresign';
import {
  openGrant,
  openRecord,
  openingSchema,
  holdingsCloseSchema,
  closingBalances,
  canonical,
  entryVerdict,
  holdingsVerdict,
  decryptEntry,
  contractPeriod,
  hashRecord,
  hex32,
  type EntryArtifact,
  type EntryVerdict,
} from '@quaestor/core';
import type { M2Context } from './m2Context.js';
import { m2Root } from './m2Context.js';
import { readJson } from './m3Shared.js';
import { readRegistry } from '../src/tickets/kemRegistry.js';
import { fullRootHistory } from '../src/rootHistory.js';
import { addressSchema } from '../src/config.js';
import type { M4Manifest } from './m4Manifest.js';
export async function auditBookM4(
  context: M2Context,
  manifest: M4Manifest,
  kind: 'honest' | 'attack',
  abi: Abi,
  auditBlock: bigint,
) {
  const book = manifest[kind];
  const closeBlock = BigInt(book.closeTx.blockNumber);
  const read = (name: string, args: readonly unknown[], block = closeBlock) =>
    context.reader.readContract({ address: manifest.contract, abi, functionName: name, args, blockNumber: block });
  const registry = await readRegistry(context.config, manifest.business, closeBlock);
  const at = await readRegistry(context.config, manifest.business, auditBlock);
  const grantAnchor = await read(
    'grants',
    [book.book, contractPeriod(manifest.periodA), context.account.evm],
    auditBlock,
  );
  if (grantAnchor !== hashRecord(book.grant)) throw new Error('GRANT_ANCHOR_MISMATCH');
  const key = openGrant(
    book.grant,
    book.book,
    manifest.periodA,
    context.account.cosmos,
    context.sealKeys,
    manifest.business,
    at.pqPublicKey,
  );
  if (
    addressSchema.parse(await read('books', [book.book])).toLowerCase() !==
    parseAddress(manifest.business).hex.toLowerCase()
  )
    throw new Error('BOOK_OWNER_MISMATCH');
  const opening = openRecord(
    book.opening,
    key,
    `quaestor:${book.book}:${kind}-opening`,
    openingSchema,
    manifest.business,
    registry.pqPublicKey,
  );
  if (opening.book !== book.book || (await read('openings', [book.book])) !== book.opening.sha3)
    throw new Error('OPENING_MISMATCH');
  const close = openRecord(
    book.close,
    key,
    `quaestor:${book.book}:${kind}-close`,
    holdingsCloseSchema,
    manifest.business,
    registry.pqPublicKey,
  );
  const state = z
    .tuple([z.bigint(), hex32, z.boolean(), hex32])
    .parse(await read('periods', [book.book, contractPeriod(manifest.periodA)]));
  if (
    !state[2] ||
    state[0] !== BigInt(close.entryCount) ||
    state[1] !== close.lastEntrySha3 ||
    state[3] !== book.close.sha3 ||
    close.book !== book.book ||
    close.period !== manifest.periodA ||
    close.entryCount !== book.entries.length ||
    close.priorSha3 !== book.opening.sha3
  )
    throw new Error('CLOSE_MISMATCH');
  const roots = await fullRootHistory(context.reader, context.config, context.poolAbi, closeBlock);
  const entries = [];
  const plaintext = [];
  let previous: `0x${string}` = `0x${'00'.repeat(32)}`;
  const check = async (artifact: EntryArtifact, expectedPrevSha3: `0x${string}`): Promise<EntryVerdict> => {
    const anchor = z
      .tuple([hex32, hex32])
      .parse(await read('entryAnchors', [book.book, contractPeriod(manifest.periodA), BigInt(artifact.index)]));
    return entryVerdict({
      artifact,
      anchor: {
        book: book.book,
        period: manifest.periodA,
        index: artifact.index,
        blobSha3: anchor[0],
        prevSha3: anchor[1],
      },
      key,
      signer: manifest.business,
      pqPublicKey: registry.pqPublicKey,
      expectedPrevSha3,
      pool: manifest.pool,
      receiptVkey: readJson(`${m2Root}/apps/web/public/circuits/receipt_vkey.json`),
      roots: roots.roots,
    });
  };
  for (const [index, artifact] of book.entries.entries()) {
    if (artifact.index !== index) throw new Error('ENTRY_ORDER_INVALID');
    const verdict = await check(artifact, previous);
    entries.push({ index, blobSha3: artifact.blobSha3, verdict });
    plaintext.push(decryptEntry(artifact, key));
    previous = artifact.blobSha3;
  }
  if (
    previous !== close.lastEntrySha3 ||
    canonical(closingBalances(opening.openingBalance, plaintext, close.cashOutFees)) !== canonical(close.closingBalance)
  )
    throw new Error('CLOSING_BALANCE_MISMATCH');
  const spent = new Map<string, boolean>();
  let spentAfterClose = false;
  for (const proof of Object.values(close.holdings)) {
    if (!proof) continue;
    for (const n of proof.publicSignals.slice(4)) {
      if (BigInt(n) === 0n) continue;
      const nullifier = toHex(BigInt(n), { size: 32 });
      const old: unknown = await context.reader.readContract({
        address: manifest.pool,
        abi: context.poolAbi,
        functionName: 'spent',
        args: [nullifier],
        blockNumber: closeBlock,
      });
      spent.set(BigInt(n).toString(), z.boolean().parse(old));
      const now: unknown = await context.reader.readContract({
        address: manifest.pool,
        abi: context.poolAbi,
        functionName: 'spent',
        args: [nullifier],
        blockNumber: auditBlock,
      });
      if (old === false && now === true) spentAfterClose = true;
    }
  }
  const period = await holdingsVerdict({
    close,
    pool: manifest.pool,
    fundsVkey: readJson(`${m2Root}/apps/web/public/circuits/funds_vkey.json`),
    roots: roots.roots,
    spent,
  });
  const tampered = kind === 'attack' ? await check(manifest.attack.servedTamper, `0x${'00'.repeat(32)}`) : null;
  return {
    book: book.book,
    closeBlock: closeBlock.toString(),
    rootHistorySize: roots.roots.size,
    entries,
    period,
    nullifiersChecked: spent.size,
    spentAfterClose,
    tampered,
  };
}
