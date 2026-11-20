import { z } from 'zod';

export const addressSchema = z.string().regex(/^0x[\da-fA-F]{40}$/).transform(value => value as `0x${string}`);
export const hexSchema = z.string().regex(/^0x(?:[\da-fA-F]{2})+$/).transform(value => value as `0x${string}`);
export const uintSchema = z.string().regex(/^(0|[1-9]\d*)$/);
export const configSchema = z.object({
  chainId: z.literal(9800),
  nativeChainId: z.literal('qorechain-diana'),
  pool: addressSchema,
  fusd: addressSchema,
  evmRpc: z.string().url(),
  rest: z.string().url(),
  consensusRpc: z.string().url(),
  deployBlock: uintSchema.transform(BigInt),
  chunkSize: uintSchema.transform(BigInt).refine(value => value > 0n),
}).strict();
export type ChainConfig = z.infer<typeof configSchema>;
export const parseConfig = (input: unknown): ChainConfig => configSchema.parse(input);
