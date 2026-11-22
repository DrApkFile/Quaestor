import { encodePacked, keccak256, encodeFunctionData, hexToBytes, toHex, zeroAddress, type Hex } from 'viem';
import { periodKey, sealRecord, grantPeriod, hashRecord, contractPeriod, type EpochKey } from '@quaestor/core';
import { parseAddress } from '@qorechain/qoresign';
import { BusinessRuntime, deployment, booksAbi } from './runtime.js';
import { resolveRecipient } from './recipients.js';
import { client } from './runtime.js';
import { post, blobBytes, jsonBytes } from './blobs.js';
import { requireWindow } from './windows.js';
import type { Book } from './schema.js';
export const zeroHash: Hex = `0x${'00'.repeat(32)}`;
export function periodDate(mode: Book['mode'], at: Date) {
  return mode === 'Daily (demo-scale)'
    ? at.toISOString().slice(0, 10)
    : `${String(at.getUTCFullYear())}-${String(Math.floor(at.getUTCMonth() / 3) * 3 + 1).padStart(2, '0')}-01`;
}
export const epoch = (period: Book['periods'][number]): EpochKey => ({
  epoch: BigInt(period.epoch),
  key: hexToBytes(period.key),
});
export async function anchorGrant(
  runtime: BusinessRuntime,
  book: Book,
  period: Book['periods'][number],
  auditor: string,
) {
  await requireWindow(runtime, 2);
  const recipient = await resolveRecipient(auditor, await client.getBlockNumber({ cacheTime: 0 }));
  const id = `grant-${book.id.slice(2)}-${period.id}-${auditor}`;
  const prior = await runtime.storage.get(id);
  const { grantSchema } = await import('@quaestor/core');
  const grant =
    prior === undefined
      ? grantPeriod(
          book.id,
          period.id,
          auditor,
          epoch(period),
          recipient.recipient,
          new Date().toISOString(),
          runtime.signing,
        )
      : grantSchema.parse(prior);
  await runtime.storage.put(id, grant);
  await post(runtime, `${id}-blob`, 'grant', jsonBytes(grant));
  await runtime.call(
    `${id}-anchor`,
    deployment.books.address,
    encodeFunctionData({
      abi: booksAbi,
      functionName: 'anchorGrant',
      args: [book.id, contractPeriod(period.id), parseAddress(auditor).hex, hashRecord(grant)],
    }),
  );
}
export async function createBook(runtime: BusinessRuntime, name: string, mode: Book['mode']) {
  await requireWindow(runtime, 4);
  const label = `${name.replace(/\s*\(demo\)$/, '')} (demo)`;
  let book = runtime.state.books.find((value) => !value.registered && value.name === label);
  if (!book) {
    const salt = toHex(crypto.getRandomValues(new Uint8Array(32)));
    const id = keccak256(encodePacked(['address', 'bytes32'], [runtime.account.evm as Hex, salt]));
    const key = periodKey(1n, crypto.getRandomValues(new Uint8Array(32)));
    const active = periodDate(mode, new Date());
    const owned = runtime.journal.read().notes.filter((note) => note.state === 'OWNED');
    const openingBalance: Record<string, string> = { [zeroAddress]: '0' };
    for (const note of owned)
      openingBalance[note.asset.toLowerCase()] = (
        BigInt(openingBalance[note.asset.toLowerCase()] ?? '0') + BigInt(note.amountWei)
      ).toString();
    const opening = { v: 1 as const, book: id, openingBalance, periodLength: mode, at: new Date().toISOString() };
    const sealedOpening = sealRecord(opening, key, runtime.signing, `quaestor:${id}:opening`);
    book = {
      id,
      salt,
      name: label,
      mode,
      opening,
      sealedOpening,
      registered: false,
      active,
      periods: [
        {
          id: active,
          epoch: '1',
          key: toHex(key.key),
          start: openingBalance,
          entries: [],
          close: null,
          sealedClose: null,
          closed: false,
        },
      ],
    };
    runtime.state.books.push(book);
    await runtime.save();
  }
  await post(runtime, `opening-${book.id.slice(2)}`, 'opening', blobBytes(book.sealedOpening.blob));
  await runtime.call(
    `register-${book.id.slice(2)}`,
    deployment.books.address,
    encodeFunctionData({ abi: booksAbi, functionName: 'registerBook', args: [book.salt, book.sealedOpening.sha3] }),
  );
  book.registered = true;
  await runtime.save();
  const first = book.periods[0];
  if (!first) throw new Error('PERIOD_REQUIRED');
  await anchorGrant(runtime, book, first, runtime.account.cosmos);
  return book;
}
export async function nextPeriod(runtime: BusinessRuntime, book: Book) {
  const prior = book.periods.find((period) => period.id === book.active);
  if (!prior?.closed || !prior.close) throw new Error('PERIOD_NOT_CLOSED');
  const date = new Date(`${prior.id}T00:00:00Z`);
  if (book.mode === 'Daily (demo-scale)') date.setUTCDate(date.getUTCDate() + 1);
  else date.setUTCMonth(date.getUTCMonth() + 3);
  const id = periodDate(book.mode, date),
    key = periodKey(BigInt(book.periods.length + 1), crypto.getRandomValues(new Uint8Array(32)));
  let period = book.periods.find((value) => value.id === id);
  if (!period) {
    period = {
      id,
      epoch: key.epoch.toString(),
      key: toHex(key.key),
      start: prior.close.closingBalance,
      entries: [],
      close: null,
      sealedClose: null,
      closed: false,
    };
    book.periods.push(period);
  }
  await runtime.save();
  await anchorGrant(runtime, book, period, runtime.account.cosmos);
  book.active = id;
  await runtime.save();
}
