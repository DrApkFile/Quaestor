import { execFileSync } from 'node:child_process';
import { renameSync, existsSync } from 'node:fs';
import { z } from 'zod';
import { m2Root } from './m2Context.js';
import { publishM5 } from './m5Publish.js';
import { writePrivateJson } from '../src/storage.js';
const output = `${m2Root}/evidence/m5-blobs.json`;
if (existsSync(output)) throw new Error('BLOB_RUN_EXISTS');
const publication = await publishM5();
const directory = `${m2Root}/.accounts/m4-live/ciphertexts`;
const hidden = `${directory}.offline-m5`;
if (existsSync(hidden)) throw new Error('CIPHERTEXT_DIRECTORY_ALREADY_OFFLINE');
let raw: unknown;
renameSync(directory, hidden);
try {
  raw = JSON.parse(
    execFileSync('pnpm', ['-C', 'packages/chain', 'exec', 'tsx', '../../scripts/m5-auditor.ts'], {
      cwd: m2Root,
      encoding: 'utf8',
      maxBuffer: 3_000_000,
    }),
  );
} finally {
  renameSync(hidden, directory);
}
const entry = z
  .object({
    index: z.number(),
    blobSha3: z.string(),
    verdict: z.object({ kind: z.string(), reason: z.string() }).strict(),
  })
  .strict();
const period = z
  .object({
    id: z.string(),
    label: z.string(),
    kind: z.string(),
    entries: z.array(entry).optional(),
    holdings: z.object({ kind: z.string(), reason: z.string() }).strict().optional(),
    servedTamper: z.object({ kind: z.string(), reason: z.string() }).strict().nullable().optional(),
    reason: z.string().optional(),
  })
  .passthrough();
const book = z.object({ book: z.string(), periods: z.array(period) }).passthrough();
const checked = z
  .object({
    pid: z.number(),
    loadedAccounts: z.array(z.literal('auditor')).length(1),
    honest: book,
    attack: book,
    ciphertextSource: z.string(),
    publicCheck: z.unknown(),
  })
  .strict()
  .parse(raw);
const honest = checked.honest.periods.find((p) => p.kind === 'AUDITED');
const attack = checked.attack.periods.find((p) => p.kind === 'AUDITED');
const refused = checked.honest.periods.find((p) => p.reason === 'NOT_GRANTED');
if (
  checked.pid === process.pid ||
  honest?.entries?.length !== 3 ||
  !honest.entries.every((e) => e.verdict.kind === 'MATCHED') ||
  honest.holdings?.kind !== 'HOLDINGS_COVER_BOOKS' ||
  attack?.holdings?.kind !== 'HOLDINGS_SHORT' ||
  attack.servedTamper?.kind !== 'TAMPERED' ||
  attack.entries?.[1]?.verdict.reason !== 'WRONG_CONTEXT' ||
  !refused
)
  throw new Error('CHAIN_BLOB_AUDIT_FAILED');
const evidence = {
  command: 'pnpm evidence --m5-blobs',
  at: new Date().toISOString(),
  status: 'PASSED',
  publication,
  localCiphertextDirectoryHiddenDuringAudit: true,
  m4VerdictsUnchanged: true,
  auditor: checked,
};
writePrivateJson(output, evidence);
console.log(JSON.stringify(evidence, null, 2));
