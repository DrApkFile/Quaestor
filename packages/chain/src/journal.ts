import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import { addressSchema, hexSchema, uintSchema } from './config.js';
import { roleSchema, type Role } from './accounts.js';
import { gasSchema } from './gas.js';
import { writePrivateJson } from './storage.js';

export const noteSchema = z.object({
  secret: hexSchema, commitment: hexSchema, nullifier: hexSchema,
  amountWei: uintSchema, asset: addressSchema, owner: roleSchema,
  state: z.enum(['INCOMING', 'OWNED', 'SPENDING', 'SPENT']),
}).strict();
const preparedSchema = z.object({
  data: hexSchema, valueWei: uintSchema, root: hexSchema.nullable(), nullifier: hexSchema.nullable(),
  feeWei: uintSchema, outputs: z.array(noteSchema),
}).strict();
const receiptSchema = z.object({
  hash: hexSchema, blockNumber: uintSchema, blockHash: hexSchema,
  gasUsed: uintSchema, effectiveGasPrice: uintSchema, status: z.enum(['success', 'reverted']),
}).strict();
export const operationSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/), requestKey: z.string(),
  stage: z.enum(['PLANNED', 'PROVED', 'BROADCAST', 'LANDED', 'TICKET_POSTED', 'OUTCOME_UNKNOWN']),
  input: hexSchema.nullable(), prepared: preparedSchema.nullable(), hash: hexSchema.nullable(),
  ticket: z.object({ memoId: z.string(), memoHash: hexSchema, commitment: hexSchema, sha3: hexSchema }).strict().optional(),
  gas: gasSchema.optional(), receipt: receiptSchema.nullable(), plannedAt: z.string().datetime(), updatedAt: z.string().datetime(),
}).strict();
const journalSchema = z.object({ v: z.literal(1), operations: z.array(operationSchema), notes: z.array(noteSchema) }).strict();
export type StoredNote = z.infer<typeof noteSchema>;
export type Prepared = z.infer<typeof preparedSchema>;
export type Operation = z.infer<typeof operationSchema>;
export type StoredReceipt = z.infer<typeof receiptSchema>;
export type JournalData = z.infer<typeof journalSchema>;

export class Journal {
  constructor(readonly path: string, readonly owner?: Role) {}
  read(): JournalData {
    if (!existsSync(this.path)) return { v: 1, operations: [], notes: [] };
    const body: unknown = JSON.parse(readFileSync(this.path, 'utf8'));
    const parsed = journalSchema.safeParse(body);
    if (!parsed.success || (this.owner !== undefined && parsed.data.notes.some(note => note.owner !== this.owner))) throw new Error('JOURNAL_INVALID');
    return parsed.data;
  }
  save(data: JournalData): void {
    const parsed = journalSchema.safeParse(data);
    if (!parsed.success || (this.owner !== undefined && parsed.data.notes.some(note => note.owner !== this.owner))) throw new Error('JOURNAL_INVALID');
    writePrivateJson(this.path, parsed.data);
  }
  async exclusive<T>(run: () => Promise<T>): Promise<T> {
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    let descriptor: number;
    try { descriptor = openSync(`${this.path}.lock`, 'wx', 0o600); }
    catch { throw new Error('JOURNAL_LOCKED'); }
    try { return await run(); }
    finally { closeSync(descriptor); unlinkSync(`${this.path}.lock`); }
  }
}
