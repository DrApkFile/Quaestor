import { existsSync } from 'node:fs';
import { z } from 'zod';
import { zeroAddress } from 'viem';
import { m2Context, m2Root, type M2Context } from './m2Context.js';
import { readJson } from './m3Shared.js';
import { nativeRecordSchema } from './m2Evidence.js';
import { writePrivateJson } from '../src/storage.js';
import { registerPqcKey } from '../src/pqcKey.js';
import { registerKemKey, readRegistry } from '../src/tickets/kemRegistry.js';
import { createCard, cardSchema, saveCard, verifyCard } from '../src/tickets/card.js';
import { accountSecrets } from '../src/nativeError.js';
import { sealSecrets } from '../src/tickets/sealKeys.js';
import { openWindow } from '../src/window.js';
import { Journal, noteSchema } from '../src/journal.js';
export const m4Dir = `${m2Root}/.accounts/m4-live`;
export const m4Public = `${m4Dir}/ciphertexts`;
const nativePath = `${m4Dir}/native.json`;
export const nativeRecords = () =>
  existsSync(nativePath) ? z.array(nativeRecordSchema).parse(readJson(nativePath)) : [];
function record(
  context: M2Context,
  action: 'register-pq' | 'register-kem' | 'open-window',
  transaction: { hash: string; height: number; gasUsed: string },
) {
  const records = nativeRecords();
  records.push({ role: context.role, action, ...transaction });
  writePrivateJson(nativePath, records);
}
export async function windowM4(context: M2Context, txs: bigint, value: bigint) {
  const opened = await openWindow(context.config, context.account, txs, value);
  record(context, 'open-window', opened.transaction);
  return opened.transaction;
}
export async function contextsM4() {
  const [business, client, supplier1, supplier2, auditor] = await Promise.all(
    ['business', 'client', 'supplier1', 'supplier2', 'auditor'].map((role) =>
      m2Context(z.enum(['business', 'client', 'supplier1', 'supplier2', 'auditor']).parse(role), 'm4-live'),
    ),
  );
  if (!business || !client || !supplier1 || !supplier2 || !auditor) throw new Error('ACCOUNTS_REQUIRED');
  return { business, client, supplier1, supplier2, auditor };
}
export async function onboardM4(context: M2Context) {
  const pq = await registerPqcKey(context.config, context.account);
  if (pq.kind === 'REGISTERED') record(context, 'register-pq', pq.transaction);
  const block = await context.reader.getBlockNumber({ cacheTime: 0 });
  const kem = await registerKemKey(context.config, context.account, context.sealKeys, block, (tx) => {
    record(context, 'register-kem', tx);
  });
  if (kem.kind === 'KEM_KEY_MISMATCH' || kem.kind === 'KEM_REGISTRATION_FAILED') throw new Error(kem.kind);
  const at = await context.reader.getBlockNumber({ cacheTime: 0 });
  const registry = await readRegistry(context.config, context.account.cosmos, at);
  const path = `${m2Root}/cards/${context.account.cosmos}.json`;
  const card = existsSync(path)
    ? cardSchema.parse(readJson(path))
    : createCard(context.account, context.sealKeys, new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'));
  if (verifyCard(card, registry).kind !== 'VERIFIED') throw new Error('CARD_INVALID');
  saveCard(path, card, [...accountSecrets(context.account), ...sealSecrets(context.sealKeys)]);
}
export async function openingNotes(context: M2Context) {
  const path = `${m4Dir}/opening-notes.json`;
  if (existsSync(path)) return z.array(noteSchema).parse(readJson(path));
  const candidates = [
    new Journal(`${m2Root}/.accounts/m1/journal.json`),
    new Journal(`${m2Root}/.accounts/m3-incoming/business.json`, 'business'),
  ]
    .flatMap((journal) => journal.read().notes)
    .filter(
      (note) =>
        note.owner === 'business' &&
        note.state === 'OWNED' &&
        note.asset === zeroAddress &&
        BigInt(note.amountWei) > 0n,
    );
  const at = await context.reader.getBlockNumber({ cacheTime: 0 });
  const notes = [];
  for (const note of candidates) {
    const spent: unknown = await context.reader.readContract({
      address: context.config.pool,
      abi: context.poolAbi,
      functionName: 'spent',
      args: [note.nullifier],
      blockNumber: at,
    });
    if (spent === false) notes.push(note);
    else if (spent !== true) throw new Error('SPENT_STATUS_INVALID');
  }
  const distinct = [...new Map(notes.map((note) => [note.commitment, note])).values()];
  writePrivateJson(path, distinct);
  return distinct;
}
