import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { deriveUnifiedAccount } from '@qorechain/sdk';
import { makeBoundNotePoseidon } from '@gloamtrade/sdk';
import { seal, recipientOf, parseEnvelope, recipientHint, type SealKeyPair } from '@qorechain/qoreseal';
import { zeroAddress } from 'viem';
import { beforeAll, expect, it, vi } from 'vitest';
import { accountSealKeys } from '../src/tickets/sealKeys.js';
import type { RegistrySnapshot } from '../src/tickets/kemRegistry.js';
import { createCard, verifyCard, type VerifiedRecipient } from '../src/tickets/card.js';
import { sealTicket, openTicket, ticketAad, ticketMetadata, type TicketNote } from '../src/tickets/ticket.js';
import { receiveMemo } from '../src/tickets/receive.js';
import { Journal } from '../src/journal.js';
import { executeOperation } from '../src/executor.js';
import { fakeGateway, note as inputNote, output, prepared, request } from './fixtures.js';

const pool = '0x27dd6fd63b1cfdce96f6202b259e45a9587c8c55';
const phrases = ['abandon '.repeat(11) + 'about',
  'legal winner thank year wave sausage worth useful legal winner thank yellow',
  'letter advice cage absurd amount doctor acoustic avoid letter advice cage above'];
let identities: Awaited<ReturnType<typeof deriveUnifiedAccount>>[];
let keys: SealKeyPair[];
let recipients: [VerifiedRecipient, VerifiedRecipient];
let note: TicketNote;
let envelope: Uint8Array;
beforeAll(async () => {
  identities = await Promise.all(phrases.map(phrase => deriveUnifiedAccount(phrase, 0)));
  keys = identities.map(accountSealKeys);
  recipients = [0, 1].map(index => {
    const account = identities[index]!;
    const sealKeys = keys[index]!;
    const card = createCard(account, sealKeys, '2026-11-20T00:00:00Z');
    const verified = verifyCard(card, { address: account.cosmos, block: 42n, possessionProven: true,
      pqPublicKey: account.pqc.publicKey, mlkemPublicKey: sealKeys.mlkemPublicKey });
    if (verified.kind !== 'VERIFIED') throw new Error('CARD_INVALID');
    return verified;
  }) as [VerifiedRecipient, VerifiedRecipient];
  const minted = await makeBoundNotePoseidon(2_000_000_000_000_000_000n, zeroAddress);
  note = { v: 1, secret: minted.secret, commitment: minted.commitment, nullifier: minted.nullifier,
    amountWei: '2000000000000000000', asset: zeroAddress, pool, chainId: 9800 };
  envelope = await sealTicket(note, recipients);
}, 60_000);

it('T-TICKET-NO-CLASSICAL-FALLBACK contains no forbidden ticket implementation or curve imports in our packages', () => {
  const forbidden = ['sealTo' + 'ReceiveTag', 'openSealed' + 'Ticket', 'receive' + 'Tag.ts', ['P', '256'].join('-'), ['EC', 'DH'].join('')];
  const result = spawnSync('rg', ['-l', '--glob', '*.{ts,tsx,js,mjs,cjs}', '--glob', '!node_modules/**', '--glob', '!dist/**',
    forbidden.join('|'), 'packages'], { cwd: fileURLToPath(new URL('../../../', import.meta.url)), encoding: 'utf8' });
  expect(result.status, result.stdout).toBe(1);
});
it('T-TICKET seals a real two-recipient hybrid envelope within 8192 bytes and opens for both recipients', async () => {
  expect(ticketMetadata(envelope)).toEqual({ bytes: envelope.length, mode: 'hybrid', recipients: 2 });
  expect(envelope.length).toBeLessThanOrEqual(8192);
  expect(await openTicket(envelope, keys[0]!, pool, note.commitment)).toEqual(note);
  expect(await openTicket(envelope, keys[1]!, pool, note.commitment)).toEqual(note);
});
it('T-TICKET refuses an outsider and authenticates the reconstructed AAD', async () => {
  await expect(openTicket(envelope, keys[2]!, pool, note.commitment)).rejects.toMatchObject({ code: 'DECRYPTION_FAILED' });
  await expect(openTicket(envelope, keys[0]!, zeroAddress, note.commitment)).rejects.toMatchObject({ code: 'DECRYPTION_FAILED' });
});
it('T-TICKET-NO-CLASSICAL-FALLBACK refuses weaker modes, anonymous envelopes and oversized input', async () => {
  await expect(sealTicket(note, recipients, { mode: 'mlkem', anonymous: false })).rejects.toMatchObject({ code: 'TICKET_INVALID' });
  await expect(sealTicket(note, recipients, { mode: 'hybrid', anonymous: false })).rejects.toMatchObject({ code: 'TICKET_INVALID' });
  for (const mode of ['mlkem', 'hybrid'] as const) {
    const invalid = seal({ chainId: 'qorechain-diana', purpose: 'quaestor:ticket', mode,
      anonymous: false, recipients: keys.slice(0, 2).map(recipientOf), plaintext: new Uint8Array(), aad: ticketAad(pool, note.commitment) });
    await expect(openTicket(invalid, keys[0]!, pool, note.commitment)).rejects.toMatchObject({ code: 'TICKET_INVALID' });
  }
  expect(() => ticketMetadata(new Uint8Array(8193))).toThrow('TICKET_INVALID');
});
it('T-CARD refuses another signing identity, stale KEM registration and unproven possession', () => {
  const account = identities[0]!;
  const card = createCard(account, keys[0]!, '2026-11-20T00:00:00Z');
  const registry = { address: account.cosmos, block: 42n, possessionProven: true as const,
    pqPublicKey: account.pqc.publicKey, mlkemPublicKey: keys[0]!.mlkemPublicKey };
  expect(verifyCard(card, { ...registry, pqPublicKey: identities[1]!.pqc.publicKey })).toEqual({ kind: 'CARD_INVALID' });
  const otherCard = createCard(identities[1]!, keys[1]!, '2026-11-20T00:00:00Z');
  expect(verifyCard({ ...card, signature: otherCard.signature }, registry)).toEqual({ kind: 'CARD_INVALID' });
  expect(verifyCard(card, { ...registry, possessionProven: false } as unknown as RegistrySnapshot)).toEqual({ kind: 'CARD_INVALID' });
  expect(verifyCard(card, { ...registry, mlkemPublicKey: keys[2]!.mlkemPublicKey })).toEqual({ kind: 'CARD_INVALID' });
  expect(verifyCard({ ...card, secretKey: 'forbidden' }, registry)).toEqual({ kind: 'CARD_INVALID' });
});
it('T-NOTES payee ownership requires opening and pinned tree inclusion; replay never revives a spent note', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'quaestor-tickets-'));
  try {
    const journal = new Journal(join(directory, 'supplier1.json'), 'supplier1');
    const memo = { commitment: note.commitment, envelope, hash: note.commitment, block: 41n };
    const missing = vi.fn(async () => ({ included: false, spent: false, root: note.commitment }));
    expect(await receiveMemo(journal, memo, keys[0]!, zeroAddress, 42n, missing)).toMatchObject({ kind: 'REFUSED', code: 'DECRYPTION_FAILED' });
    expect(missing).not.toHaveBeenCalled();
    expect(await receiveMemo(journal, memo, keys[0]!, pool, 42n, missing)).toMatchObject({ kind: 'REFUSED', code: 'TICKET_INVALID' });
    expect(journal.read().notes).toEqual([]);
    await journal.exclusive(async () => {
      const locked = await receiveMemo(journal, memo, keys[0]!, pool, 42n, async () => ({ included: true, spent: false, root: note.commitment }));
      expect(locked).toMatchObject({ kind: 'REFUSED', code: 'JOURNAL_LOCKED' });
    });
    const included = vi.fn(async () => {
      expect(journal.read().notes).toEqual([]);
      return { included: true, spent: false, root: note.commitment };
    });
    expect(await receiveMemo(journal, memo, keys[0]!, pool, 42n, included)).toMatchObject({ kind: 'OPENED', treeIncluded: true });
    expect(journal.read().notes[0]?.state).toBe('OWNED');
    const data = journal.read();
    data.notes[0]!.state = 'SPENT'; journal.save(data);
    expect(await receiveMemo(journal, memo, keys[0]!, pool, 42n, async () => ({ included: true, spent: true, root: note.commitment })))
      .toMatchObject({ kind: 'REFUSED', code: 'TICKET_INVALID' });
    expect(journal.read().notes[0]?.state).toBe('SPENT');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
it('T-NOTES the payer journal retains change without granting the payee ownership', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'quaestor-payer-'));
  try {
    const journal = new Journal(join(directory, 'business.json'), 'business');
    journal.save({ v: 1, operations: [], notes: [inputNote] });
    const change = { ...output, commitment: `0x${'ef'.repeat(31)}ab` as const, owner: 'business' as const };
    const result = await executeOperation(journal, { ...request(), build: async () => ({ ...prepared, outputs: [output, change] }) }, fakeGateway());
    expect(result.kind).toBe('LANDED');
    expect(journal.read().notes.map(item => [item.owner, item.state])).toEqual([['business', 'SPENT'], ['business', 'OWNED']]);
    expect(journal.read().operations[0]?.prepared?.outputs[0]?.state).toBe('INCOMING');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

it('T-TICKET anonymous hints cannot be matched with any registered public key', () => {
  const parsed = parseEnvelope(envelope);
  expect(parsed.anonymous).toBe(true);
  for (const entry of parsed.entries) {
    expect(entry.hint.every(byte => byte === 0)).toBe(true);
    for (const key of keys) expect(entry.hint).not.toEqual(recipientHint(parsed.salt, key.mlkemPublicKey));
  }
});
