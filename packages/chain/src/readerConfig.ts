import { z } from 'zod';
import { parseConfig, addressSchema, hexSchema } from './config.js';
const contract = z
  .object({
    address: addressSchema,
    deployBlock: z.string().regex(/^\d+$/).transform(BigInt),
    chunkSize: z.string().regex(/^\d+$/).transform(BigInt),
  })
  .strict();
export const deploymentSchema = z
  .object({
    chain: z.unknown().transform(parseConfig),
    books: contract,
    board: contract,
    legacyBooks: z.record(z.enum(['honest', 'attack'])),
    demo: z.object({ honest: hexSchema, attack: hexSchema, periodA: z.string(), periodB: z.string() }).strict(),
  })
  .strict();
