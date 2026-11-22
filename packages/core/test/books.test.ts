import { it, expect } from 'vitest';
import { classicalKeyFromPrivate, pqKeyFromSeed, addressFromPublicKey } from '@qorechain/qoresign';
import { sealKeysFromSeed, recipientOf } from '@qorechain/qoreseal';
import { zeroAddress, hexToBytes, type Hex } from 'viem';
import {
  sealEntry,
  openEntry,
  verifyArtifact,
  receiptContext,
  requireEntryChain,
  grantPeriod,
  openGrant,
  periodKey,
  hashRecord,
  hashBytes,
  closeRecord,
  declaredOpening,
  sealRecord,
  openRecord,
  holdingsCloseSchema,
} from '../src/index.js';

const classicalKey = classicalKeyFromPrivate(new Uint8Array(32).fill(1), 'eth_secp256k1');
const pqKey = pqKeyFromSeed(new Uint8Array(32).fill(2));
const signer = addressFromPublicKey(classicalKey.publicKey, 'eth_secp256k1').bech32;
const signing = { signer, classicalKey, pqKey };
const book: Hex = `0x${'12'.repeat(32)}`;
const zero: Hex = `0x${'00'.repeat(32)}`;
const auditor = 'qor1auditor';
const keys = sealKeysFromSeed(new Uint8Array(32).fill(3));
const outsider = sealKeysFromSeed(new Uint8Array(32).fill(4));
const keyA = periodKey(1n, new Uint8Array(32).fill(5));
const keyB = periodKey(2n, new Uint8Array(32).fill(6));
function input(index: number, prev: Hex, period = '2026-11-20') {
  return {
    v: 1,
    book,
    period,
    index,
    prevEntrySha3: prev,
    direction: 'OUT',
    asset: zeroAddress,
    amount: '1000000000000000000',
    paymentCommitment: book,
    counterparty: { address: auditor, name: 'Supplier (demo)' },
    purpose: 'Test (demo)',
    category: 'operations',
    notes: 'Synthetic fixture',
    receipt: {
      proof: { pi_a: ['0'], pi_b: [['0']], pi_c: ['0'] },
      publicSignals: [
        '0',
        '0',
        '0',
        '0',
        '1',
        '1000000000000000000',
        receiptContext(book, period, index, zeroAddress).toString(),
      ],
    },
  };
}
it('T-SEAL auditor opens only its granted demo-scale period and outsiders are refused', () => {
  const grant = grantPeriod(book, '2026-11-20', auditor, keyA, recipientOf(keys), '2026-11-20T00:00:00Z', signing);
  const opened = openGrant(grant, book, '2026-11-20', auditor, keys, signer, pqKey.publicKey);
  expect(opened).toEqual(keyA);
  expect(() => openGrant(grant, book, '2026-11-21', auditor, keys, signer, pqKey.publicKey)).toThrow('NOT_GRANTED');
  expect(() => openGrant(grant, book, '2026-11-20', auditor, outsider, signer, pqKey.publicKey)).toThrow('NOT_GRANTED');
  const entry = sealEntry(input(0, zero), keyA, signing, zeroAddress);
  expect(openEntry(entry, opened, zeroAddress).amount).toBe('1000000000000000000');
  expect(() => openEntry(entry, keyB, zeroAddress)).toThrow('NOT_GRANTED');
});
it('T-BIND edited ciphertext fails the anchor SHA3 and signature even if its stated digest is replaced', () => {
  const entry = sealEntry(input(0, zero), keyA, signing, zeroAddress);
  verifyArtifact(entry, entry.blobSha3, signer, pqKey.publicKey);
  const edited = { ...entry, blob: `${entry.blob.slice(0, -2)}${entry.blob.endsWith('00') ? '01' : '00'}` as Hex };
  expect(() => {
    verifyArtifact(edited, entry.blobSha3, signer, pqKey.publicKey);
  }).toThrow('TAMPERED');
  const replacedDigest = { ...edited, blobSha3: hashBytes(hexToBytes(edited.blob)) };
  expect(() => {
    verifyArtifact(replacedDigest, replacedDigest.blobSha3, signer, pqKey.publicKey);
  }).toThrow('TAMPERED');
  const forged = {
    ...entry,
    signature: {
      ...entry.signature,
      pq: { algorithmId: 1 as const, signature: Buffer.alloc(4627).toString('base64') },
    },
  };
  expect(() => {
    verifyArtifact(forged, entry.blobSha3, signer, pqKey.publicKey);
  }).toThrow('TAMPERED');
});
it('T-BOOKS previous hashes reject reordering, removed entries and closing before anchors land', () => {
  const first = sealEntry(input(0, zero), keyA, signing, zeroAddress);
  const second = sealEntry(input(1, first.blobSha3), keyA, signing, zeroAddress);
  requireEntryChain([first, second], 2);
  expect(() => {
    requireEntryChain([second, first], 2);
  }).toThrow('CHAIN_BROKEN');
  expect(() => {
    requireEntryChain([first], 2);
  }).toThrow('CHAIN_BROKEN');
  expect(() => closeRecord(book, '2026-11-20', [first, second], 1)).toThrow('UNANCHORED');
  expect(hashRecord(closeRecord(book, '2026-11-20', [first, second], 2))).toMatch(/^0x/);
});
it('T-BIND receipt context binds book, period and index before sealing', () => {
  const entry = input(0, zero);
  expect(() => sealEntry({ ...entry, index: 1 }, keyA, signing, zeroAddress)).toThrow('WRONG_CONTEXT');
  expect(() => sealEntry({ ...entry, period: '2026-11-21' }, keyA, signing, zeroAddress)).toThrow('WRONG_CONTEXT');
  expect(() => sealEntry({ ...entry, book: zero }, keyA, signing, zeroAddress)).toThrow('WRONG_CONTEXT');
});

it('T-BIND authenticated batch metadata mismatches remain TAMPERED while a wrong key is NOT_GRANTED', () => {
  const entry = sealEntry(input(0, zero), keyA, signing, zeroAddress);
  for (const changed of [
    { ...entry, book: zero },
    { ...entry, index: 1 },
    { ...entry, period: '2026-11-21' },
    { ...entry, prevEntrySha3: book },
  ])
    expect(() => openEntry(changed, keyA, zeroAddress)).toThrow('TAMPERED');
  expect(() => openEntry(entry, { epoch: keyA.epoch, key: keyB.key }, zeroAddress)).toThrow('NOT_GRANTED');
  expect(() => openEntry({ ...entry, blob: '0x00' }, keyA, zeroAddress)).toThrow('TAMPERED');
});

it('T-PERIOD-B-ONLY later-period key opens its signed declared opening without granting the first period', () => {
  const grant = grantPeriod(book, '2026-11-21', auditor, keyB, recipientOf(keys), '2026-11-21T00:00:00Z', signing);
  const granted = openGrant(grant, book, '2026-11-21', auditor, keys, signer, pqKey.publicKey);
  const close = {
    v: 1 as const,
    book,
    period: '2026-11-21',
    entryCount: 0,
    lastEntrySha3: zero,
    priorSha3: book,
    openingBalance: { [zeroAddress]: '5' },
    closingBalance: { [zeroAddress]: '5' },
    cashOutFees: {},
    holdings: {},
  };
  const sealed = sealRecord(close, keyB, signing, `quaestor:${book}:close`);
  const opened = openRecord(sealed, granted, `quaestor:${book}:close`, holdingsCloseSchema, signer, pqKey.publicKey);
  expect(declaredOpening(opened, null, book)).toEqual(close.openingBalance);
  expect(() => declaredOpening(opened, { [zeroAddress]: '6' }, book)).toThrow('TAMPERED');
  expect(() => declaredOpening(opened, null, zero)).toThrow('TAMPERED');
  expect(() => openEntry(sealEntry(input(0, zero), keyA, signing, zeroAddress), granted, zeroAddress)).toThrow(
    'NOT_GRANTED',
  );
});
