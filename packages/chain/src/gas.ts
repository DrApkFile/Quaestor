import { z } from 'zod';
import { uintSchema } from './config.js';
export const MAX_GAS_LIMIT = 3000000n;
export const gasSchema = z
  .object({
    estimatedGas: uintSchema,
    gasLimit: uintSchema,
    maxFeePerGas: uintSchema,
    estimationBlock: uintSchema,
  })
  .strict();
export type SignedGas = z.infer<typeof gasSchema>;
export function gasLimitForEstimate(estimate: bigint): bigint {
  if (estimate <= 0n || estimate > MAX_GAS_LIMIT) throw new Error('GAS_ESTIMATE_OUT_OF_RANGE');
  const padded = (estimate * 5n + 3n) / 4n;
  return padded > MAX_GAS_LIMIT ? MAX_GAS_LIMIT : padded;
}
