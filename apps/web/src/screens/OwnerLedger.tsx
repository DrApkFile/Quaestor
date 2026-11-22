import { openEntry, verifyArtifact } from '@quaestor/core';
import { Ledger, type LedgerRow } from '../Ledger.js';
import { browserChain } from '../business/runtime.js';
import { epoch } from '../business/books.js';
import type { BusinessRuntime } from '../business/runtime.js';
import type { Book } from '../business/schema.js';
export function OwnerLedger({
  runtime,
  book,
  period,
}: {
  runtime: BusinessRuntime;
  book: Book;
  period: Book['periods'][number];
}) {
  const rows: LedgerRow[] = period.entries.map((saved) => {
    verifyArtifact(saved.artifact, saved.artifact.blobSha3, runtime.account.cosmos, runtime.account.pqc.publicKey);
    const entry = openEntry(saved.artifact, epoch(period), browserChain.pool);
    const tx = runtime.state.transactions.find(
      (value) => value.id === `entry-${book.id.slice(2)}-${period.id}-${String(entry.index)}-anchor`,
    );
    return {
      entry,
      blobSha3: saved.artifact.blobSha3,
      anchorHash: tx?.hash ?? null,
      status: saved.anchored ? 'Anchored' : 'Unanchored',
    };
  });
  if (period.id === book.active)
    for (const payment of runtime.state.payments.filter((value) => !value.book))
      rows.push({
        entry: {
          period: period.id,
          direction: payment.direction,
          asset: payment.note.asset,
          amount: payment.note.amountWei,
          counterparty: { address: payment.counterparty, name: 'Counterparty (demo)' },
          purpose: 'Not booked',
          category: '—',
        },
        status: 'Not booked',
      });
  return <Ledger rows={rows} />;
}
