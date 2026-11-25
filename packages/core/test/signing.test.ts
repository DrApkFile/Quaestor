import { it, expect } from 'vitest';
import { signMessage, classicalKeyFromPrivate, pqKeyFromSeed, addressFromPublicKey } from '@qorechain/qoresign';
import { toBytes } from 'viem';
import { signHash, requireSignature, signatureSchema } from '../src/signing.js';
const classicalKey = classicalKeyFromPrivate(new Uint8Array(32).fill(71), 'eth_secp256k1');
const pqKey = pqKeyFromSeed(new Uint8Array(32).fill(72));
const signer = addressFromPublicKey(classicalKey.publicKey, 'eth_secp256k1').bech32;
const keys = { signer, classicalKey, pqKey };
const hash = `0x${'12'.repeat(32)}` as const;
it('T-M12 QoreSign records hedge repeated signing and both signatures verify', () => {
  const first = signHash(hash, keys),
    second = signHash(hash, keys);
  expect(first.pq.signature).not.toBe(second.pq.signature);
  expect(first.classical).toEqual(second.classical);
  for (const signature of [first, second])
    expect(() => requireSignature(hash, signature, signer, pqKey.publicKey)).not.toThrow();
});
it('T-M12 pre-M12 deterministic QoreSign records still verify without migration', () => {
  const legacy = () =>
    signatureSchema.parse(
      signMessage({
        chainId: 'qorechain-diana',
        signer,
        data: toBytes(hash),
        classicalKey,
        pqKey,
        hedged: false,
      }),
    );
  const first = legacy();
  expect(first).toEqual(legacy());
  expect(() => requireSignature(hash, first, signer, pqKey.publicKey)).not.toThrow();
});
