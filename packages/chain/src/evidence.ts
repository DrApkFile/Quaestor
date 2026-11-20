import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';
import { addressSchema, hexSchema, uintSchema } from './config.js';
import { gasSchema } from './gas.js';
import { writePrivateJson } from './storage.js';
import type { Operation } from './journal.js';

const nativeTransactionSchema = z.object({
  action: z.enum(['register-business', 'register-supplier1', 'window-business', 'window-supplier1', 'convert-fusd']),
  hash: z.string().regex(/^[\dA-Fa-f]{64}$/), height: z.number().int(), gasUsed: uintSchema,
  feeUqor: uintSchema,
}).strict();
const balanceSchema = z.object({ block: uintSchema, wei: uintSchema }).strict();
const paymentSchema = z.object({
  gas: gasSchema.optional(), id: z.string(), hash: hexSchema, blockNumber: uintSchema, blockHash: hexSchema,
  gasUsed: uintSchema, effectiveGasPrice: uintSchema, status: z.enum(['success', 'reverted']),
  root: hexSchema.nullable(), nullifier: hexSchema.nullable(), feeWei: uintSchema,
  commitments: z.array(hexSchema), plannedAt: z.string().datetime(), landedAt: z.string().datetime(),
}).strict();
export const evidenceSchema = z.object({
  v: z.literal(1), command: z.literal('pnpm evidence --m1'), commit: z.string(),
  network: z.literal('qorechain-diana'), chainId: z.literal(9800), pool: addressSchema,
  demo: z.literal(true), asset: z.literal('native QOR'), proofSystem: z.literal('Groth16 BN254; not post-quantum'),
  status: z.enum(['RUNNING', 'PASSED', 'FAILED']), startedAt: z.string().datetime(), updatedAt: z.string().datetime(),
  supplier: addressSchema, before: balanceSchema, beforeUnshield: balanceSchema.nullable(), after: balanceSchema.nullable(),
  nativeTransactions: z.array(nativeTransactionSchema), payments: z.array(paymentSchema),
  tree: z.object({ block: uintSchema, root: hexSchema, leafCount: z.number().int(), requestedRange: uintSchema, effectiveRange: uintSchema }).strict().nullable(),
  balanceCheck: z.object({ expectedDeltaWei: z.string().regex(/^-?\d+$/), actualDeltaWei: z.string().regex(/^-?\d+$/), passed: z.boolean() }).strict().nullable(),
  fusd: z.object({ status: z.enum(['CONVERTED', 'FAILED']), before: uintSchema.nullable(), after: uintSchema.nullable(),
    code: z.number().int().nullable().optional(), codespace: z.string().nullable().optional(),
    rawLog: z.string().max(500).nullable().optional(), transactionHash: z.string().regex(/^[\da-fA-F]{64}$/).nullable().optional(),
    bankBefore: uintSchema.nullable(), bankAfter: uintSchema.nullable(), errorCode: z.string().nullable(), at: z.string().datetime() }).strict().nullable(),
  errorCode: z.string().nullable(),
}).strict();
export type RoundtripEvidence = z.infer<typeof evidenceSchema>;
export function readEvidence(path: string): RoundtripEvidence | null {
  if (!existsSync(path)) return null;
  const body: unknown = JSON.parse(readFileSync(path, 'utf8'));
  return evidenceSchema.parse(body);
}
export function saveEvidence(path: string, evidence: RoundtripEvidence) {
  evidence.updatedAt = new Date().toISOString();
  writePrivateJson(path, evidenceSchema.parse(evidence));
}
export function paymentEvidence(operation: Operation): RoundtripEvidence['payments'][number] {
  if (!operation.receipt || !operation.prepared || !operation.hash) throw new Error('RECEIPT_REQUIRED');
  return { id: operation.id, ...operation.receipt, ...(operation.gas ? { gas: operation.gas } : {}),
    root: operation.prepared.root, nullifier: operation.prepared.nullifier, feeWei: operation.prepared.feeWei,
    commitments: operation.prepared.outputs.map(note => note.commitment),
    plannedAt: operation.plannedAt, landedAt: operation.updatedAt };
}
