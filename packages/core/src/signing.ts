import { signMessage, verifyMessage, type ClassicalKey, type PqKeyPair } from '@qorechain/qoresign';
import { z } from 'zod';
import { toBytes, type Hex } from 'viem';
import { BookError } from './codec.js';

export const signatureSchema = z.object({ signatureType: z.literal('ml-dsa-87-hybrid'),
 classical: z.object({keyType:z.literal('eth_secp256k1'),publicKey:z.string(),signature:z.string()}).strict(),
 pq:z.object({algorithmId:z.literal(1),signature:z.string()}).strict() }).strict();
export type Signature = z.infer<typeof signatureSchema>;
export interface SigningKeys { signer: string; classicalKey: ClassicalKey; pqKey: Pick<PqKeyPair,'secretKey'> }
export function signHash(hash: Hex, keys: SigningKeys): Signature {
  return signatureSchema.parse(signMessage({ chainId:'qorechain-diana', signer:keys.signer, data:toBytes(hash),
    classicalKey:keys.classicalKey, pqKey:keys.pqKey }));
}
export function requireSignature(hash: Hex, signature: Signature, signer: string, pqPublicKey: Uint8Array): void {
  try { verifyMessage({chainId:'qorechain-diana', signer, data:toBytes(hash), signature, pqPublicKey, requirePq:true}); }
  catch { throw new BookError('TAMPERED'); }
}
