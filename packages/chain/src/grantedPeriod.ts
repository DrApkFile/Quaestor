import { toHex, type Hex } from 'viem';
import {
  openGrant,
  openingSchema,
  holdingsCloseSchema,
  decryptEntry,
  entryVerdict,
  holdingsVerdict,
  closingBalances,
  canonical,
  type EntryVerdict,
} from '@quaestor/core';
import type { BookSnapshot, PeriodRow } from './booksReader.js';
import { ownerKey, entryArtifact, recordCipher } from './blobReader.js';
import { fullRootHistory } from './rootHistory.js';
import { poolReadAbi, type AuditConfig, type AuditIdentity } from './auditTypes.js';
import { decodeRecord, type grantBody } from './auditRecords.js';
export async function grantedPeriod(
  context: AuditConfig,
  snapshot: BookSnapshot,
  period: PeriodRow,
  grant: Awaited<ReturnType<typeof grantBody>>,
  identity: AuditIdentity,
  seen: Set<string>,
  descriptors: unknown[],
) {
  const pq = await ownerKey(context, snapshot);
  const key = openGrant(
    grant,
    snapshot.book,
    grant.record.period,
    identity.address,
    identity.keys,
    pq.address,
    pq.publicKey,
  );
  if (!period.closed || period.closeBlock === null)
    return { id: period.id, label: grant.record.period, kind: 'UNKNOWN' as const, reason: 'PERIOD_OPEN' as const };
  const closeBlock = period.closeBlock;
  const historical = await ownerKey(context, snapshot, closeBlock);
  if (toHex(historical.publicKey) !== toHex(pq.publicKey)) throw new Error('PQC_KEY_CHANGED');
  const openingRef = await recordCipher(context, snapshot, 'opening', snapshot.openingSha3, pq);
  const closeRef = await recordCipher(context, snapshot, 'close', period.closeSha3, pq);
  const opening = decodeRecord(openingRef, key, openingSchema, historical);
  const close = decodeRecord(closeRef, key, holdingsCloseSchema, historical);
  const rows = snapshot.entries.filter((row) => row.period === period.id).sort((a, b) => a.index - b.index);
  if (
    opening.book !== snapshot.book ||
    close.book !== snapshot.book ||
    close.period !== grant.record.period ||
    close.entryCount !== period.count ||
    rows.length !== period.count ||
    close.lastEntrySha3 !== period.lastSha3 ||
    close.priorSha3 !== snapshot.openingSha3
  )
    throw new Error('TAMPERED');
  const history = await fullRootHistory(context.client, context.chain, poolReadAbi, closeBlock);
  const receiptVkey = await context.vkey('receipt');
  const entries = [];
  const plaintext = [];
  let previous: Hex = `0x${'00'.repeat(32)}`;
  let firstInput: Parameters<typeof entryVerdict>[0] | null = null;
  for (const row of rows) {
    if (row.index !== entries.length) throw new Error('TAMPERED');
    const artifact = await entryArtifact(context, snapshot, row, descriptors, pq);
    const input = {
      artifact,
      anchor: {
        book: snapshot.book,
        period: grant.record.period,
        index: row.index,
        blobSha3: row.blobSha3,
        prevSha3: row.prevSha3,
      },
      key,
      signer: pq.address,
      pqPublicKey: historical.publicKey,
      expectedPrevSha3: previous,
      pool: context.chain.pool,
      receiptVkey,
      roots: history.roots,
      seenPayments: seen,
    };
    const verdict = await entryVerdict(input);
    if (!firstInput) firstInput = input;
    const entry = decryptEntry(artifact, key);
    seen.add(entry.paymentCommitment.toLowerCase());
    plaintext.push(entry);
    entries.push({ index: row.index, blobSha3: row.blobSha3, verdict });
    previous = row.blobSha3;
  }
  if (
    previous !== close.lastEntrySha3 ||
    canonical(closingBalances(opening.openingBalance, plaintext, close.cashOutFees)) !== canonical(close.closingBalance)
  )
    throw new Error('TAMPERED');
  const spent = new Map<string, boolean>();
  let spentAfterClose = false;
  for (const proof of Object.values(close.holdings)) {
    if (!proof) continue;
    for (const text of proof.publicSignals.slice(4)) {
      const value = BigInt(text);
      if (value === 0n) continue;
      const nullifier = toHex(value, { size: 32 });
      const old = await context.client.readContract({
        address: context.chain.pool,
        abi: poolReadAbi,
        functionName: 'spent',
        args: [nullifier],
        blockNumber: closeBlock,
      });
      const now = await context.client.readContract({
        address: context.chain.pool,
        abi: poolReadAbi,
        functionName: 'spent',
        args: [nullifier],
        blockNumber: snapshot.block,
      });
      spent.set(value.toString(), old);
      if (!old && now) spentAfterClose = true;
    }
  }
  const holdings = await holdingsVerdict({
    close,
    pool: context.chain.pool,
    fundsVkey: await context.vkey('funds'),
    roots: history.roots,
    spent,
  });
  let servedTamper: EntryVerdict | null = null;
  if (firstInput?.artifact) {
    const original = firstInput.artifact;
    const blob = `${original.blob.slice(0, -2)}${original.blob.endsWith('00') ? '01' : '00'}` as Hex;
    servedTamper = await entryVerdict({ ...firstInput, artifact: { ...original, blob } });
  }
  return {
    id: period.id,
    label: grant.record.period,
    periodLength: opening.periodLength ?? 'Daily (demo-scale)',
    kind: 'AUDITED' as const,
    entries,
    holdings,
    closeBlock: closeBlock.toString(),
    rootHistorySize: history.roots.size,
    nullifiersChecked: spent.size,
    spentAfterClose,
    legacyRecordsVerified: openingRef.legacy !== null && closeRef.legacy !== null,
    servedTamper,
  };
}
