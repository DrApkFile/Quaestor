import { groth16 } from 'snarkjs';
import { receiptSchema } from './entry.js';
import { z } from 'zod';
export const fundsSchema = receiptSchema.extend({ publicSignals: z.array(z.string().regex(/^\d+$/)).length(8) });
export type Proof = z.infer<typeof receiptSchema>;
export const verifyProof = (vkey: unknown, value: Proof): Promise<boolean> =>
  groth16.verify(vkey, value.publicSignals, value.proof, undefined, { singleThread: true });
