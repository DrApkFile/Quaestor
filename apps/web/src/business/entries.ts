import { z } from 'zod';
import { buildReceiptWitness } from '@gloamtrade/sdk';
import { sealBatch } from '@qorechain/qoreseal';
import { sealEntry, receiptContext, receiptSchema, hashBytes, contractPeriod } from '@quaestor/core';
import { createPoolTreeSync, requireNotePath } from '@quaestor/chain/browser';
import { encodeFunctionData, toHex } from 'viem';
import { BusinessRuntime, client, browserChain, poolAbi, booksAbi, deployment } from './runtime.js';
import { browserProof } from '../browserProof.js';
import { post, blobBytes, jsonBytes } from './blobs.js';
import { epoch, zeroHash } from './books.js';
import { requireWindow } from './windows.js';
import type { Book, Payment } from './schema.js';
export interface EntryFields {
  name: string;
  purpose: string;
  category: string;
  notes: string;
  invoice?: File;
}
export async function bookPayment(runtime: BusinessRuntime, book: Book, payment: Payment, fields: EntryFields) {
  const period = book.periods.find((value) => value.id === book.active);
  if (!period || period.closed) throw new Error('PERIOD_CLOSED');
  if (payment.book && payment.book !== book.id) throw new Error('PAYMENT_ALREADY_BOOKED');
  await requireWindow(runtime, fields.invoice ? 4 : 3);
  let saved = period.entries.find((value) => value.entry.paymentCommitment === payment.note.commitment);
  if (!saved) {
    if (period.entries.some((value) => !value.anchored)) throw new Error('UNANCHORED');
    const index = period.entries.length;
    const tree = await createPoolTreeSync(client, browserChain, poolAbi)(await client.getBlockNumber({ cacheTime: 0 }));
    const witness = await buildReceiptWitness({
      secretHex: payment.note.secret,
      amount: BigInt(payment.note.amountWei),
      asset: payment.note.asset,
      path: await requireNotePath(tree.tree, payment.note.commitment),
      reveal: true,
      context: receiptContext(book.id, period.id, index, browserChain.pool),
    });
    if (witness.blocker) throw new Error('RECEIPT_WITNESS_FAILED');
    const receipt = receiptSchema.parse(await browserProof('receipt', witness.circomInput, runtime.progress));
    let invoice: { sha3: `0x${string}`; bytes: number } | undefined;
    if (fields.invoice) {
      if (!fields.invoice.size || fields.invoice.size > 20480) throw new Error('INVOICE_TOO_LARGE');
      const prior = await runtime.storage.get(`invoice-${payment.id}`);
      const data = new Uint8Array(await fields.invoice.arrayBuffer());
      const blob =
        prior === undefined
          ? sealBatch({ epochKey: epoch(period), context: 'quaestor:invoice', batchIndex: index, data }).blob
          : Uint8Array.from(z.array(z.number()).parse(prior));
      invoice = { sha3: hashBytes(blob), bytes: fields.invoice.size };
      await runtime.storage.put(`invoice-${payment.id}`, Array.from(blob));
      await post(runtime, `invoice-${payment.id}`, 'invoice', blob);
    }
    const entry = {
      v: 1 as const,
      book: book.id,
      period: period.id,
      index,
      prevEntrySha3: period.entries.at(-1)?.artifact.blobSha3 ?? zeroHash,
      direction: payment.direction,
      asset: payment.note.asset,
      amount: payment.note.amountWei,
      paymentCommitment: payment.note.commitment,
      counterparty: { address: payment.counterparty, name: `${fields.name.replace(/\s*\(demo\)$/, '')} (demo)` },
      purpose: fields.purpose,
      category: fields.category,
      notes: fields.notes,
      receipt,
      ...(invoice ? { invoice } : {}),
    };
    const artifact = sealEntry(entry, epoch(period), runtime.signing, browserChain.pool);
    saved = { artifact, entry, anchored: false };
    period.entries.push(saved);
    payment.book = book.id;
    payment.period = period.id;
    payment.entryIndex = index;
    payment.stage = 'BOOKED';
    await runtime.save();
    runtime.progress('Booked · posting sealed entry');
  }
  const artifact = saved.artifact;
  const id = `entry-${book.id.slice(2)}-${period.id}-${String(artifact.index)}`;
  await post(runtime, `${id}-blob`, 'entry', blobBytes(artifact.blob));
  await post(runtime, `${id}-signature`, 'entry', jsonBytes(artifact));
  await runtime.call(
    `${id}-anchor`,
    deployment.books.address,
    encodeFunctionData({
      abi: booksAbi,
      functionName: 'anchorEntry',
      args: [book.id, contractPeriod(period.id), BigInt(artifact.index), artifact.blobSha3, artifact.prevEntrySha3],
    }),
  );
  saved.anchored = true;
  payment.stage = 'ANCHORED';
  await runtime.save();
  runtime.progress('Anchored');
  await runtime.journal.exclusive(async () => {
    const data = runtime.journal.read();
    const operation = data.operations.find((value) => value.id === payment.id);
    if (operation) {
      operation.stage = 'ANCHORED';
      operation.bookEntry = {
        book: book.id,
        period: period.id,
        index: artifact.index,
        blobSha3: artifact.blobSha3,
        anchorHash: runtime.state.transactions.find((tx) => tx.id === `${id}-anchor`)?.hash ?? null,
      };
      runtime.journal.save(data);
      await runtime.journal.flush();
    }
  });
  return toHex(blobBytes(artifact.blob));
}
