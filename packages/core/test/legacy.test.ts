import { it, expect } from 'vitest';
import { classicalKeyFromPrivate, pqKeyFromSeed, addressFromPublicKey } from '@qorechain/qoresign';
import { hexToBytes, type Hex } from 'viem';
import { z } from 'zod';
import {
  periodKey,
  hashBytes,
  sealLegacyRecord,
  sealRecord,
  openRecord,
  signLegacyMap,
  verifyLegacyMap,
  openMappedRecord,
} from '../src/index.js';
const classicalKey = classicalKeyFromPrivate(new Uint8Array(32).fill(31), 'eth_secp256k1');
const pqKey = pqKeyFromSeed(new Uint8Array(32).fill(32));
const signer = addressFromPublicKey(classicalKey.publicKey, 'eth_secp256k1').bech32;
const signing = { signer, classicalKey, pqKey };
const key = periodKey(1n, new Uint8Array(32).fill(33));
const book: Hex = `0x${'44'.repeat(32)}`;
const schema = z.object({ v: z.literal(1), label: z.literal('synthetic (demo)') }).strict();
const record = { v: 1 as const, label: 'synthetic (demo)' as const };
it('T-LEGACY mismatched decrypted plaintext hash and non-owner mapping signature are TAMPERED', () => {
  const blob = sealLegacyRecord(record, key, signing, 'synthetic:legacy');
  const mapping = signLegacyMap(
    { book, kind: 'opening', anchoredSha3: blob.sha3, ciphertextSha3: hashBytes(hexToBytes(blob.blob)) },
    signing,
  );
  expect(
    openMappedRecord(
      verifyLegacyMap(mapping, book, 'opening', blob.sha3, signer, pqKey.publicKey),
      blob.blob,
      key,
      'synthetic:legacy',
      schema,
      signer,
      pqKey.publicKey,
    ),
  ).toEqual(record);
  const wrong = signLegacyMap({ ...mapping.record, anchoredSha3: book }, signing);
  expect(() =>
    openMappedRecord(
      verifyLegacyMap(wrong, book, 'opening', book, signer, pqKey.publicKey),
      blob.blob,
      key,
      'synthetic:legacy',
      schema,
      signer,
      pqKey.publicKey,
    ),
  ).toThrow('TAMPERED');
  const other = pqKeyFromSeed(new Uint8Array(32).fill(35));
  const impostor = signLegacyMap(mapping.record, { ...signing, pqKey: other });
  expect(() => verifyLegacyMap(impostor, book, 'opening', blob.sha3, signer, pqKey.publicKey)).toThrow('TAMPERED');
});
it('T-RECORD new opening/close anchors hash ciphertext instead of guessable plaintext', () => {
  const value = sealRecord(record, key, signing, 'synthetic:new');
  expect(value.sha3).toBe(hashBytes(hexToBytes(value.blob)));
  expect(openRecord(value, key, 'synthetic:new', schema, signer, pqKey.publicKey)).toEqual(record);
  expect(() => openRecord({ ...value, sha3: book }, key, 'synthetic:new', schema, signer, pqKey.publicKey)).toThrow(
    'TAMPERED',
  );
});
