import { signRecipientCard, verifyRecipientCard, type SealKeyPair, type SealRecipient } from '@qorechain/qoreseal';
import type { UnifiedAccount } from '@qorechain/sdk';
import { hexToBytes } from 'viem';
import { z } from 'zod';
import { hexSchema } from '../config.js';
import type { RegistrySnapshot } from './kemRegistry.js';
const signatureSchema = z
  .object({
    signatureType: z.literal('ml-dsa-87-hybrid'),
    classical: z.object({ keyType: z.literal('eth_secp256k1'), publicKey: z.string(), signature: z.string() }).strict(),
    pq: z.object({ algorithmId: z.literal(1), signature: z.string() }).strict(),
  })
  .strict();
export const cardSchema = z
  .object({
    version: z.literal(1),
    chainId: z.literal('qorechain-diana'),
    address: z.string().regex(/^qor1[0-9a-z]+$/),
    mlkemKeySha3: z.string().regex(/^[0-9a-f]{64}$/),
    x25519PublicKey: z.string().regex(/^[0-9a-f]{64}$/),
    issuedAt: z.string().datetime(),
    signature: signatureSchema,
  })
  .strict();
export type PublicCard = z.infer<typeof cardSchema>;
export interface VerifiedRecipient {
  kind: 'VERIFIED';
  address: string;
  block: bigint;
  recipient: SealRecipient;
}
export function verifyCard(
  input: unknown,
  registry: RegistrySnapshot,
):
  | VerifiedRecipient
  | {
      kind: 'CARD_INVALID';
    } {
  const parsed = cardSchema.safeParse(input);
  if (!parsed.success || !registry.possessionProven) return { kind: 'CARD_INVALID' };
  try {
    const recipient = verifyRecipientCard({
      card: parsed.data,
      chainId: 'qorechain-diana',
      address: registry.address,
      pqPublicKey: registry.pqPublicKey,
      mlkemPublicKey: registry.mlkemPublicKey,
    });
    return { kind: 'VERIFIED', address: registry.address, block: registry.block, recipient };
  } catch {
    return { kind: 'CARD_INVALID' };
  }
}
export function createCard(account: UnifiedAccount, keys: SealKeyPair, issuedAt: string): PublicCard {
  const card = signRecipientCard({
    chainId: 'qorechain-diana',
    address: account.cosmos,
    keys,
    issuedAt,
    classicalKey: {
      type: 'eth_secp256k1',
      privateKey: hexToBytes(hexSchema.parse(account.privateKey)),
      publicKey: hexToBytes(hexSchema.parse(account.publicKey)),
    },
    pqKey: { secretKey: account.pqc.secretKey },
  });
  const parsed = cardSchema.safeParse(card);
  if (!parsed.success) throw new Error('CARD_INVALID');
  return parsed.data;
}
