import { readFileSync } from 'node:fs';
import { signRecipientCard, verifyRecipientCard, type SealKeyPair, type SealRecipient } from '@qorechain/qoreseal';
import type { UnifiedAccount } from '@qorechain/sdk';
import { hexToBytes } from 'viem';
import { hexSchema } from '../config.js';
import { z } from 'zod';
import type { RegistrySnapshot } from './kemRegistry.js';
import { readRegistry } from './kemRegistry.js';
import type { ChainConfig } from '../config.js';
import { writePrivateJson } from '../storage.js';

const signatureSchema = z.object({ signatureType: z.literal('ml-dsa-87-hybrid'),
  classical: z.object({ keyType: z.literal('eth_secp256k1'), publicKey: z.string(), signature: z.string() }).strict(),
  pq: z.object({ algorithmId: z.literal(1), signature: z.string() }).strict(),
}).strict();
export const cardSchema = z.object({
  version: z.literal(1), chainId: z.literal('qorechain-diana'), address: z.string().regex(/^qor1[0-9a-z]+$/),
  mlkemKeySha3: z.string().regex(/^[0-9a-f]{64}$/), x25519PublicKey: z.string().regex(/^[0-9a-f]{64}$/),
  issuedAt: z.string().datetime(), signature: signatureSchema,
}).strict();
export type PublicCard = z.infer<typeof cardSchema>;
export interface VerifiedRecipient { kind: 'VERIFIED'; address: string; block: bigint; recipient: SealRecipient }
export function verifyCard(input: unknown, registry: RegistrySnapshot): VerifiedRecipient | { kind: 'CARD_INVALID' } {
  const parsed = cardSchema.safeParse(input);
  if (!parsed.success || registry.possessionProven !== true) return { kind: 'CARD_INVALID' };
  try {
    const recipient = verifyRecipientCard({ card: parsed.data, chainId: 'qorechain-diana', address: registry.address,
      pqPublicKey: registry.pqPublicKey, mlkemPublicKey: registry.mlkemPublicKey });
    return { kind: 'VERIFIED', address: registry.address, block: registry.block, recipient };
  } catch { return { kind: 'CARD_INVALID' }; }
}
export function createCard(account: UnifiedAccount, keys: SealKeyPair, issuedAt: string): PublicCard {
  const card = signRecipientCard({ chainId: 'qorechain-diana', address: account.cosmos, keys, issuedAt,
    classicalKey: { type: 'eth_secp256k1', privateKey: hexToBytes(hexSchema.parse(account.privateKey)), publicKey: hexToBytes(hexSchema.parse(account.publicKey)) },
    pqKey: { secretKey: account.pqc.secretKey } });
  const parsed = cardSchema.safeParse(card);
  if (!parsed.success) throw new Error('CARD_INVALID');
  return parsed.data;
}
export function saveCard(path: string, card: unknown, secrets: readonly string[]) {
  const parsed = cardSchema.safeParse(card);
  if (!parsed.success) throw new Error('CARD_INVALID');
  const text = JSON.stringify(parsed.data);
  if (secrets.some(secret => secret.length > 0 && text.includes(secret))) throw new Error('CARD_INVALID');
  writePrivateJson(path, parsed.data);
}
export async function resolveCard(config: ChainConfig, path: string, address: string, block: bigint): Promise<VerifiedRecipient | { kind: 'CARD_INVALID' }> {
  try {
    const input: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return verifyCard(input, await readRegistry(config, address, block));
  } catch { return { kind: 'CARD_INVALID' }; }
}
