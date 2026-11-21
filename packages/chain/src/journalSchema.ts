import { z } from 'zod';
import { addressSchema, hexSchema, uintSchema } from './config.js';
import { roleSchema } from './roles.js';
import { gasSchema } from './gas.js';
export const noteSchema = z
  .object({
    secret: hexSchema,
    commitment: hexSchema,
    nullifier: hexSchema,
    amountWei: uintSchema,
    asset: addressSchema,
    owner: roleSchema,
    state: z.enum(['INCOMING', 'OWNED', 'SPENDING', 'SPENT']),
  })
  .strict();
const preparedSchema = z
  .object({
    data: hexSchema,
    valueWei: uintSchema,
    root: hexSchema.nullable(),
    nullifier: hexSchema.nullable(),
    feeWei: uintSchema,
    outputs: z.array(noteSchema),
  })
  .strict();
const receiptSchema = z
  .object({
    hash: hexSchema,
    blockNumber: uintSchema,
    blockHash: hexSchema,
    gasUsed: uintSchema,
    effectiveGasPrice: uintSchema,
    status: z.enum(['success', 'reverted']),
  })
  .strict();
export const operationSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
    requestKey: z.string(),
    stage: z.enum([
      'PLANNED',
      'PROVED',
      'BROADCAST',
      'LANDED',
      'TICKET_POSTED',
      'BOOKED',
      'ANCHORED',
      'OUTCOME_UNKNOWN',
    ]),
    input: hexSchema.nullable(),
    prepared: preparedSchema.nullable(),
    hash: hexSchema.nullable(),
    ticket: z
      .object({ memoId: z.string(), memoHash: hexSchema, commitment: hexSchema, sha3: hexSchema })
      .strict()
      .optional(),
    bookEntry: z
      .object({
        book: hexSchema,
        period: z.string(),
        index: z.number().int().nonnegative(),
        blobSha3: hexSchema,
        anchorHash: hexSchema.nullable(),
      })
      .strict()
      .optional(),
    gas: gasSchema.optional(),
    receipt: receiptSchema.nullable(),
    plannedAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export const journalSchema = z
  .object({ v: z.literal(1), operations: z.array(operationSchema), notes: z.array(noteSchema) })
  .strict();
export type StoredNote = z.infer<typeof noteSchema>;
export type Prepared = z.infer<typeof preparedSchema>;
export type Operation = z.infer<typeof operationSchema>;
export type StoredReceipt = z.infer<typeof receiptSchema>;
export type JournalData = z.infer<typeof journalSchema>;
