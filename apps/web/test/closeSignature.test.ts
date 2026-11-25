import { it, expect } from 'vitest';
import { generatePqcKeypair, pqcSign, pqcVerify } from '@qorechain/sdk';
import { closeDigestV2 } from '@quaestor/core';
import { hexToBytes, toHex } from 'viem';
import { signCloseDigest } from '../src/business/closeSignature.js';
it('T-M12 Books closes hedge the unchanged digest and key with empty context and retain deterministic verification', () => {
  const key = generatePqcKeypair(new Uint8Array(32).fill(73));
  const hash = `0x${'12'.repeat(32)}` as const;
  const digest = closeDigestV2(hash, '2026-11-25', 0, hash, hash, 9800n, '0x9775c1d0dc814e41fb1b38d26fa17f60d24faf64');
  const first = signCloseDigest(key.secretKey, digest),
    second = signCloseDigest(key.secretKey, digest);
  expect(first).not.toBe(second);
  const deterministic = pqcSign(key.secretKey, hexToBytes(digest));
  expect(toHex(deterministic)).toBe(toHex(pqcSign(key.secretKey, hexToBytes(digest))));
  for (const signature of [hexToBytes(first), hexToBytes(second), deterministic]) {
    expect(signature.length).toBe(4627);
    expect(pqcVerify(key.publicKey, hexToBytes(digest), signature)).toBe(true);
    expect(pqcVerify(key.publicKey, new Uint8Array(32), signature)).toBe(false);
  }
});
