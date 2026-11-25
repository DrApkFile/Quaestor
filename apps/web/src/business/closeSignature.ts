import { pqcSign } from '@qorechain/sdk';
import { hexToBytes, toHex, type Hex } from 'viem';
export function signCloseDigest(secretKey: Uint8Array, digest: Hex): Hex {
  return toHex(pqcSign(secretKey, hexToBytes(digest), { hedged: true }));
}
