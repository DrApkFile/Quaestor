import { readFileSync } from 'node:fs';
import { cardSchema, verifyCard, type VerifiedRecipient } from './cardCodec.js';
export * from './cardCodec.js';
import type { ChainConfig } from '../config.js';
import { readRegistry } from './kemRegistry.js';
import { writePrivateJson } from '../storage.js';
export function saveCard(path: string, card: unknown, secrets: readonly string[]) {
  const parsed = cardSchema.safeParse(card);
  if (!parsed.success) throw new Error('CARD_INVALID');
  const text = JSON.stringify(parsed.data);
  if (secrets.some((secret) => secret.length > 0 && text.includes(secret))) throw new Error('CARD_INVALID');
  writePrivateJson(path, parsed.data);
}
export async function resolveCard(
  config: ChainConfig,
  path: string,
  address: string,
  block: bigint,
): Promise<
  | VerifiedRecipient
  | {
      kind: 'CARD_INVALID';
    }
> {
  try {
    const input: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return verifyCard(input, await readRegistry(config, address, block));
  } catch {
    return { kind: 'CARD_INVALID' };
  }
}
