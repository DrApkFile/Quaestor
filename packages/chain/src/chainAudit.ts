import { open, isQoreSealError } from '@qorechain/qoreseal';
import { parseAddress } from '@qorechain/qoresign';
import { hexToBytes, toBytes, type Hex } from 'viem';
import { readBook } from './booksReader.js';
import { discoverJSON } from './blobReader.js';
import { grantBody } from './auditRecords.js';
import { grantedPeriod } from './grantedPeriod.js';
import type { AuditConfig, AuditIdentity } from './auditTypes.js';
export * from './auditTypes.js';
export async function auditFromChain(context: AuditConfig, book: Hex, identity: AuditIdentity) {
  const snapshot = await readBook(context.client, context.books, book);
  const descriptors = await discoverJSON(context, 'entry', snapshot.block);
  const scoped = new Set<string>();
  const grants = await Promise.all(
    snapshot.grants.map(async (row) => ({ row, body: await grantBody(context, snapshot, row) })),
  );
  const periods = [];
  const ordered = [...snapshot.periods].sort((a, b) => {
    const aa = grants.find((g) => g.row.period === a.id)?.body.record.period ?? a.id;
    const bb = grants.find((g) => g.row.period === b.id)?.body.record.period ?? b.id;
    return aa.localeCompare(bb);
  });
  for (const period of ordered) {
    const grant = grants.find(
      (g) =>
        g.row.period === period.id && g.row.auditor.toLowerCase() === parseAddress(identity.address).hex.toLowerCase(),
    );
    if (grant) {
      periods.push(await grantedPeriod(context, snapshot, period, grant.body, identity, scoped, descriptors));
      continue;
    }
    const own = grants.find(
      (g) => g.row.period === period.id && g.row.auditor.toLowerCase() === snapshot.owner.toLowerCase(),
    );
    let cryptoRefusal: string | null = null;
    if (own) {
      try {
        open({
          chainId: 'qorechain-diana',
          purpose: `quaestor:${book}:period-key`,
          keys: identity.keys,
          envelope: hexToBytes(own.body.envelope),
          aad: toBytes(`${book}|${own.body.record.period}|${own.body.record.auditor}`),
        });
        throw new Error('UNEXPECTED_PERIOD_ACCESS');
      } catch (error: unknown) {
        if (isQoreSealError(error)) cryptoRefusal = error.code;
        else throw error;
      }
    }
    periods.push({
      id: period.id,
      label: own?.body.record.period ?? period.id,
      kind: 'UNKNOWN' as const,
      reason: 'NOT_GRANTED' as const,
      grantAbsent: true,
      hasEntry: period.count > 0,
      cryptoRefusal,
    });
  }
  return { book, readBlock: snapshot.block.toString(), owner: snapshot.owner, periods };
}
