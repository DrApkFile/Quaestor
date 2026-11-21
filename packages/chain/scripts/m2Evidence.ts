import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { roleSchema } from '../src/accounts.js';
import { hexSchema, uintSchema } from '../src/config.js';
import { evidenceSchema } from '../src/evidence.js';
import { nativeFailureSchema } from '../src/nativeError.js';
import { writePrivateJson } from '../src/storage.js';
export const nativeRecordSchema = z
  .object({
    role: roleSchema,
    action: z.enum(['register-pq', 'register-kem', 'open-window']),
    hash: z.string().regex(/^[\da-fA-F]{64}$/),
    height: z.number().int(),
    gasUsed: uintSchema,
  })
  .strict();
const balanceSchema = z.object({ block: uintSchema, wei: uintSchema }).strict();
export const workerSchema = z
  .object({
    role: z.enum(['supplier1', 'client']),
    pid: z.number().int(),
    loadedAccounts: z.array(roleSchema).length(1),
    journal: z.string(),
    journalInitiallyEmpty: z.boolean(),
    scanBlock: uintSchema,
    memoHash: hexSchema,
    commitment: hexSchema,
    openCode: z.string().regex(/^[A-Z_]+$/),
    treeIncluded: z.boolean(),
    treeRoot: hexSchema.nullable(),
    notesAfterScan: z.number().int(),
    scanErrors: z.array(z.object({ commitment: hexSchema, code: z.string() }).strict()),
    unshield: evidenceSchema.shape.payments.element.nullable(),
    window: nativeRecordSchema.nullable(),
    before: balanceSchema.nullable(),
    after: balanceSchema.nullable(),
    balanceMatched: z.boolean().nullable(),
  })
  .strict();
export type WorkerResult = z.infer<typeof workerSchema>;
export const m2EvidenceSchema = z
  .object({
    v: z.literal(1),
    command: z.literal('pnpm evidence --m2'),
    commit: z.string(),
    startedAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    demo: z.literal(true),
    status: z.enum(['RUNNING', 'PASSED', 'FAILED']),
    payerPid: z.number().int(),
    payerJournal: z.string(),
    nativeTransactions: z.array(nativeRecordSchema),
    identities: z.array(
      z
        .object({
          role: roleSchema,
          address: z.string(),
          kemSha3: hexSchema,
          registryBlock: uintSchema,
          cardSha3: hexSchema.nullable(),
          cardVerified: z.boolean(),
        })
        .strict(),
    ),
    importedCommitment: hexSchema.nullable(),
    payment: evidenceSchema.shape.payments.element.nullable(),
    ticket: z
      .object({
        bytes: z.number().int().positive().max(8192),
        mode: z.literal('hybrid'),
        recipientCount: z.literal(2),
        sha3: hexSchema,
        commitment: hexSchema,
        registryBlock: uintSchema,
      })
      .strict()
      .nullable(),
    memo: evidenceSchema.shape.payments.element.nullable(),
    supplier: workerSchema.nullable(),
    client: workerSchema.nullable(),
    failure: nativeFailureSchema.nullable(),
    registryReason: z.string().nullable(),
    errorCode: z.string().nullable(),
  })
  .strict();
export type M2Evidence = z.infer<typeof m2EvidenceSchema>;
export const sha3 = (bytes: Uint8Array | string): `0x${string}` =>
  `0x${createHash('sha3-256').update(bytes).digest('hex')}`;
export function loadM2Evidence(path: string): M2Evidence | null {
  if (!existsSync(path)) return null;
  const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
  return m2EvidenceSchema.parse(raw);
}
export function saveM2Evidence(path: string, evidence: M2Evidence, secrets: readonly string[]) {
  evidence.updatedAt = new Date().toISOString();
  const data = m2EvidenceSchema.parse(evidence);
  assertPublic(data, secrets);
  writePrivateJson(path, data);
}
export function assertPublic(value: unknown, secrets: readonly string[]) {
  const text = JSON.stringify(value);
  if (secrets.some((secret) => secret.length > 0 && text.includes(secret))) throw new Error('SECRET_IN_EVIDENCE');
}
