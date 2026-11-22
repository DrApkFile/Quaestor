import { webcrypto, createHash } from 'node:crypto';
import { z } from 'zod';
import { zeroAddress } from 'viem';
import { hex32 } from '@quaestor/core';
import { decryptVault } from '../../../apps/web/src/vault.js';
import { stateSchema } from '../../../apps/web/src/business/schema.js';
import { journalSchema } from '../src/journalSchema.js';
import { m2Root, type M2Context } from './m2Context.js';
import { readJson } from './m3Shared.js';
export async function duplicateSource(owner: M2Context) {
  const fixture = z
    .object({ password: z.string() })
    .passthrough()
    .parse(readJson(`${m2Root}/.accounts/m7-browser/fixtures.json`));
  const backup = await decryptVault(
    readJson(`${m2Root}/.accounts/m7-browser/business-complete.json`),
    fixture.password,
  );
  const raw = backup.journal?.records.find((row) => row.key === `${owner.account.cosmos}:business`);
  const box = z.object({ nonce: z.string(), ciphertext: z.string() }).strict().parse(raw?.value);
  const material = new Uint8Array([
    ...new TextEncoder().encode('quaestor:private-store:v1'),
    ...owner.account.pqc.secretKey,
  ]);
  const key = await webcrypto.subtle.importKey(
    'raw',
    createHash('sha3-256').update(material).digest(),
    'AES-GCM',
    false,
    ['decrypt'],
  );
  material.fill(0);
  const decoded = await webcrypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: Buffer.from(box.nonce, 'base64'),
      additionalData: new TextEncoder().encode(`${owner.account.cosmos}:business`),
    },
    key,
    Buffer.from(box.ciphertext, 'base64'),
  );
  const state = stateSchema.parse(JSON.parse(new TextDecoder().decode(decoded)) as unknown);
  const sourceBook = z
    .object({ bookId: hex32 })
    .passthrough()
    .parse(readJson(`${m2Root}/evidence/m7-browser.json`)).bookId;
  const payment = state.payments.find(
    (row) => row.book === sourceBook && row.direction === 'IN' && row.note.amountWei === '1000000000000000000',
  );
  if (!payment?.period) throw new Error('REAL_PAYMENT_REQUIRED');
  const journalRow = backup.journal?.records.find((row) => row.key === `${owner.account.cosmos}:private-journal`);
  const journalBox = z.object({ nonce: z.string(), ciphertext: z.string() }).strict().parse(journalRow?.value);
  const journalPlain = await webcrypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: Buffer.from(journalBox.nonce, 'base64'),
      additionalData: new TextEncoder().encode(`${owner.account.cosmos}:private-journal`),
    },
    key,
    Buffer.from(journalBox.ciphertext, 'base64'),
  );
  const notes = journalSchema
    .parse(JSON.parse(new TextDecoder().decode(journalPlain)) as unknown)
    .notes.filter((note) => note.state === 'OWNED' && note.asset === zeroAddress);
  return { payment, sourceBook, notes, period: payment.period };
}
