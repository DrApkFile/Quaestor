import { z } from 'zod';
import { artifactSchema, entrySchema, openingSchema, holdingsCloseSchema } from '@quaestor/core';
import { noteSchema, hexSchema, addressSchema } from '@quaestor/chain/browser';
const transaction = z.object({ id: z.string(), hash: hexSchema, block: z.string() }).strict();
export const paymentSchema = z
  .object({
    id: z.string(),
    direction: z.enum(['IN', 'OUT']),
    counterparty: z.string(),
    note: noteSchema,
    memo: hexSchema.nullable(),
    stage: z.enum(['SENT', 'TICKET_POSTED', 'BOOKED', 'ANCHORED']),
    book: hexSchema.nullable(),
    period: z.string().nullable(),
    entryIndex: z.number().nullable(),
  })
  .strict();
const sealed = z.object({ blob: hexSchema, sha3: hexSchema }).strict();
const period = z
  .object({
    id: z.string(),
    epoch: z.string(),
    key: hexSchema,
    start: z.record(z.string()),
    entries: z.array(z.object({ artifact: artifactSchema, entry: entrySchema, anchored: z.boolean() }).strict()),
    close: holdingsCloseSchema.nullable(),
    sealedClose: sealed.nullable(),
    closed: z.boolean(),
  })
  .strict();
export const bookSchema = z
  .object({
    id: hexSchema,
    salt: hexSchema,
    name: z.string(),
    mode: z.enum(['Quarterly', 'Daily (demo-scale)']),
    opening: openingSchema,
    sealedOpening: sealed,
    registered: z.boolean(),
    active: z.string(),
    periods: z.array(period),
  })
  .strict();
export const stateSchema = z
  .object({
    v: z.literal(1),
    scanBlock: z.string(),
    payments: z.array(paymentSchema),
    books: z.array(bookSchema),
    transactions: z.array(transaction),
    nativeTransactions: z.array(
      z.object({ id: z.string(), hash: z.string().regex(/^[A-Fa-f0-9]{64}$/), height: z.number().int() }).strict(),
    ),
    plans: z.array(z.object({ id: z.string(), payee: z.string(), asset: addressSchema, amount: z.string() }).strict()),
    errors: z.array(z.object({ code: z.string(), commitment: hexSchema }).strict()),
  })
  .strict();
export type BusinessState = z.infer<typeof stateSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type Book = z.infer<typeof bookSchema>;
export const emptyState = (): BusinessState => ({
  v: 1,
  scanBlock: '0',
  payments: [],
  books: [],
  transactions: [],
  nativeTransactions: [],
  plans: [],
  errors: [],
});
export const fusd = addressSchema.parse('0x97143B771D34ddb9130b807b135Ae675A5a963CA');
