import type { EntryArtifact } from '@quaestor/core';
import type { Hex } from 'viem';
import { Journal, type StoredReceipt } from './journal.js';

export function bookPayment(journal: Journal, id: string, entry: EntryArtifact): Promise<void> {
  return journal.exclusive(() =>
    Promise.resolve().then(() => {
      const data = journal.read();
      const operation = data.operations.find((item) => item.id === id);
      if (!operation?.ticket || operation.receipt?.status !== 'success') throw new Error('PAYMENT_NOT_TICKETED');
      if (operation.bookEntry) {
        if (operation.bookEntry.blobSha3 !== entry.blobSha3) throw new Error('BOOK_ENTRY_CONFLICT');
        return;
      }
      operation.bookEntry = {
        book: entry.book,
        period: entry.period,
        index: entry.index,
        blobSha3: entry.blobSha3,
        anchorHash: null,
      };
      operation.stage = 'BOOKED';
      journal.save(data);
    }),
  );
}
export function anchorPayment(journal: Journal, id: string, blobSha3: Hex, receipt: StoredReceipt): Promise<void> {
  return journal.exclusive(() =>
    Promise.resolve().then(() => {
      const data = journal.read();
      const operation = data.operations.find((item) => item.id === id);
      if (!operation?.bookEntry || operation.bookEntry.blobSha3 !== blobSha3 || receipt.status !== 'success')
        throw new Error('ENTRY_UNANCHORED');
      if (operation.bookEntry.anchorHash && operation.bookEntry.anchorHash !== receipt.hash)
        throw new Error('ANCHOR_CONFLICT');
      operation.bookEntry.anchorHash = receipt.hash;
      operation.stage = 'ANCHORED';
      journal.save(data);
    }),
  );
}
