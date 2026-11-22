import { buildFundsWitness } from '@gloamtrade/sdk';
import { pqcSign } from '@qorechain/sdk';
import {
  selectHoldingsNotes,
  closeRecord,
  closingBalances,
  holdingsContext,
  fundsSchema,
  sealRecord,
  closeDigestV2,
  contractPeriod,
  type HoldingsClose,
} from '@quaestor/core';
import { createPoolTreeSync, requireNotePath, hexSchema } from '@quaestor/chain/browser';
import { encodeFunctionData, hexToBytes, toHex, type Hex } from 'viem';
import { BusinessRuntime, client, browserChain, poolAbi, booksAbi, deployment } from './runtime.js';
import { epoch } from './books.js';
import { post, blobBytes } from './blobs.js';
import { browserProof } from '../browserProof.js';
import { requireWindow } from './windows.js';
import type { Book } from './schema.js';
export async function closePeriod(runtime: BusinessRuntime, book: Book) {
  const period = book.periods.find((value) => value.id === book.active);
  if (!period || period.closed) throw new Error('PERIOD_CLOSED');
  if (
    period.entries.some((value) => !value.anchored) ||
    runtime.state.payments.some((payment) => payment.stage !== 'ANCHORED' && payment.book === book.id)
  )
    throw new Error('UNANCHORED');
  if (runtime.state.payments.some((payment) => !payment.book)) throw new Error('UNBOOKED_PAYMENTS');
  await requireWindow(runtime, 2);
  if (!period.close || !period.sealedClose) {
    const summary = closeRecord(
      book.id,
      period.id,
      period.entries.map((value) => value.artifact),
      period.entries.length,
    );
    const cashOutFees: Record<string, string> = {};
    const previous = book.periods[book.periods.indexOf(period) - 1];
    const boundaryId = previous ? `close-${book.id.slice(2)}-${previous.id}-anchor` : `register-${book.id.slice(2)}`;
    const boundary = runtime.state.transactions.find((tx) => tx.id === boundaryId)?.block;
    if (!boundary) throw new Error('OPENING_UNAVAILABLE');
    const journal = runtime.journal.read();
    for (const operation of journal.operations) {
      if (
        !operation.id.startsWith('cashout-') ||
        operation.receipt?.status !== 'success' ||
        !operation.prepared ||
        BigInt(operation.receipt.blockNumber) <= BigInt(boundary)
      )
        continue;
      const note = journal.notes.find((value) => value.commitment === operation.input);
      if (!note) throw new Error('NOTE_UNAVAILABLE');
      const asset = note.asset.toLowerCase();
      cashOutFees[asset] = (BigInt(cashOutFees[asset] ?? '0') + BigInt(operation.prepared.feeWei)).toString();
    }
    const closingBalance = closingBalances(
      period.start,
      period.entries.map((value) => value.entry),
      cashOutFees,
    );
    const tree = await createPoolTreeSync(client, browserChain, poolAbi)(await client.getBlockNumber({ cacheTime: 0 }));
    const holdings: HoldingsClose['holdings'] = {};
    for (const [asset, amount] of Object.entries(closingBalance)) {
      const candidates = runtime.journal
        .read()
        .notes.filter(
          (note) =>
            note.state === 'OWNED' && note.asset.toLowerCase() === asset.toLowerCase() && BigInt(note.amountWei) > 0n,
        )
        .sort((a, b) => (BigInt(a.amountWei) > BigInt(b.amountWei) ? -1 : 1));
      const unspent = [];
      for (const note of candidates)
        if (
          !(await client.readContract({
            address: browserChain.pool,
            abi: poolAbi,
            functionName: 'spent',
            args: [note.nullifier],
            blockNumber: tree.block,
          }))
        )
          unspent.push(note);
      const selection = selectHoldingsNotes(unspent, BigInt(amount));
      if (selection.kind !== 'SELECTED') throw new Error(selection.kind);
      const inputs = [];
      for (const note of selection.notes)
        inputs.push({
          secretHex: note.secret,
          amount: BigInt(note.amountWei),
          path: await requireNotePath(tree.tree, note.commitment),
        });
      const witness = await buildFundsWitness({
        asset: asset as Hex,
        threshold: BigInt(amount),
        context: holdingsContext(book.id, period.id, browserChain.pool),
        notes: inputs,
      });
      if (witness.blocker) throw new Error('FUNDS_WITNESS_FAILED');
      holdings[asset] = fundsSchema.parse(await browserProof('funds', witness.circomInput, runtime.progress));
    }
    period.close = {
      ...summary,
      priorSha3: previous?.sealedClose?.sha3 ?? book.sealedOpening.sha3,
      openingBalance: period.start,
      periodLength: book.mode,
      closingBalance,
      cashOutFees,
      holdings,
    };
    period.sealedClose = sealRecord(period.close, epoch(period), runtime.signing, `quaestor:${book.id}:close`);
    await runtime.save();
  }
  const close = period.close,
    sealed = period.sealedClose;
  await post(runtime, `close-${book.id.slice(2)}-${period.id}-blob`, 'close', blobBytes(sealed.blob));
  const signatureKey = `close-signature-${book.id.slice(2)}-${period.id}`;
  const cachedSignature = await runtime.storage.get(signatureKey);
  const signature =
    cachedSignature === undefined
      ? toHex(
          pqcSign(
            runtime.account.pqc.secretKey,
            hexToBytes(
              closeDigestV2(
                book.id,
                period.id,
                close.entryCount,
                close.lastEntrySha3,
                sealed.sha3,
                9800n,
                deployment.books.address,
              ),
            ),
          ),
        )
      : hexSchema.parse(cachedSignature);
  await runtime.storage.put(signatureKey, signature);
  await runtime.call(
    `close-${book.id.slice(2)}-${period.id}-anchor`,
    deployment.books.address,
    encodeFunctionData({
      abi: booksAbi,
      functionName: 'closePeriod',
      args: [book.id, contractPeriod(period.id), BigInt(close.entryCount), close.lastEntrySha3, sealed.sha3, signature],
    }),
  );
  period.closed = true;
  await runtime.save();
}
