import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { toHex, hexToBytes, type Hex } from 'viem';
import { pqcSign } from '@qorechain/sdk';
import { z } from 'zod';
import {
  periodKey,
  grantPeriod,
  grantSchema,
  openGrant,
  bookId,
  contractPeriod,
  closeRecord,
  closeDigest,
  hashRecord,
  signHash,
} from '@quaestor/core';
import { m2Context, m2Root } from './m2Context.js';
import { publicDir, artifact, signingKeys, sendCall } from './m3Shared.js';
import { deployBooks } from './m3Deploy.js';
import { prepareEntry } from './m3Entries.js';
import { incomingPayment } from './m3Incoming.js';
import { manifestSchema } from './m3Audit.js';
import { writePrivateJson } from '../src/storage.js';
import { bookPayment, anchorPayment } from '../src/books.js';
import { Journal } from '../src/journal.js';
import { loadPoolAbi } from '../src/abi.js';
import { resolveCard } from '../src/tickets/card.js';
import { readRegistry } from '../src/tickets/kemRegistry.js';
import { accountSecrets } from '../src/nativeError.js';
import { sealSecrets } from '../src/tickets/sealKeys.js';
import { assertPublic } from './m2Evidence.js';
import { addressSchema } from '../src/config.js';
import { openWindow } from '../src/window.js';

const evidencePath = `${m2Root}/evidence/m3-books.json`;
if (existsSync(evidencePath)) throw new Error('M3_RUN_ALREADY_EXISTS');
const business = await m2Context('business', 'm3');
const auditor = await m2Context('auditor', 'm3');
const supplier = await m2Context('supplier1', 'm3');
const client = await m2Context('client', 'm3-client');
const plan = artifact(
  `${m2Root}/.accounts/m3/plan.json`,
  z
    .object({
      salt: z
        .string()
        .regex(/^0x[\da-f]{64}$/)
        .transform((v) => v as Hex),
      a: z.string(),
      b: z.string(),
      issuedAt: z.string(),
    })
    .strict(),
  () => {
    const now = new Date();
    return {
      salt: toHex(randomBytes(32)),
      a: now.toISOString().slice(0, 10),
      b: new Date(now.getTime() + 86400000).toISOString().slice(0, 10),
      issuedAt: now.toISOString(),
    };
  },
);
console.log('M3: deploy Books');
const deployment = await deployBooks();
const book = bookId(addressSchema.parse(business.account.evm), plan.salt);
const abi = loadPoolAbi(`${m2Root}/contracts/out/Books.sol/Books.json`);
const block = await business.reader.getBlockNumber({ cacheTime: 0 });
const registry = await readRegistry(business.config, business.account.cosmos, block);
const cards = await Promise.all(
  [business, auditor].map((context) =>
    resolveCard(business.config, `${m2Root}/cards/${context.account.cosmos}.json`, context.account.cosmos, block),
  ),
);
const [selfCard, auditorCard] = cards;
if (!selfCard || !auditorCard || selfCard.kind !== 'VERIFIED' || auditorCard.kind !== 'VERIFIED')
  throw new Error('CARD_INVALID');
const signer = signingKeys(business);
const selfA = artifact(`${publicDir}/self-a.json`, grantSchema, () =>
  grantPeriod(
    book,
    plan.a,
    business.account.cosmos,
    periodKey(1n, randomBytes(32)),
    selfCard.recipient,
    plan.issuedAt,
    signer,
  ),
);
const selfB = artifact(`${publicDir}/self-b.json`, grantSchema, () =>
  grantPeriod(
    book,
    plan.b,
    business.account.cosmos,
    periodKey(2n, randomBytes(32)),
    selfCard.recipient,
    plan.issuedAt,
    signer,
  ),
);
const keyA = openGrant(
  selfA,
  book,
  plan.a,
  business.account.cosmos,
  business.sealKeys,
  business.account.cosmos,
  registry.pqPublicKey,
);
const keyB = openGrant(
  selfB,
  book,
  plan.b,
  business.account.cosmos,
  business.sealKeys,
  business.account.cosmos,
  registry.pqPublicKey,
);
const grantA = artifact(`${publicDir}/auditor-a.json`, grantSchema, () =>
  grantPeriod(book, plan.a, auditor.account.cosmos, keyA, auditorCard.recipient, plan.issuedAt, signer),
);
console.log('M3: anonymous incoming client payment');
const incoming = await incomingPayment();
const oldNote = (run: string, id: string) => {
  const data = new Journal(`${m2Root}/.accounts/${run}/business.json`, 'business').read();
  const note = data.operations
    .find((operation) => operation.id === id)
    ?.prepared?.outputs.find((note) => note.owner === 'supplier1');
  if (!note) throw new Error('PAYMENT_NOTE_REQUIRED');
  return note;
};
const zero: Hex = `0x${'00'.repeat(32)}`;
console.log('M3: build real receipt proofs and seal entries');
const first = await prepareEntry(
  business,
  oldNote('m2', 'm2-send'),
  book,
  plan.a,
  0,
  zero,
  'OUT',
  supplier.account.cosmos,
  keyA,
);
const second = await prepareEntry(
  business,
  oldNote('m2b', 'm2b-send'),
  book,
  plan.a,
  1,
  first.blobSha3,
  'OUT',
  supplier.account.cosmos,
  keyA,
);
const third = await prepareEntry(business, incoming.note, book, plan.b, 0, zero, 'IN', client.account.cosmos, keyB);
const entries = [first, second, third];
const payments = [
  { journal: new Journal(`${m2Root}/.accounts/m2/business.json`, 'business'), id: 'm2-send' },
  { journal: new Journal(`${m2Root}/.accounts/m2b/business.json`, 'business'), id: 'm2b-send' },
  { journal: client.journal, id: 'm3-client-send' },
];
for (const [index, entry] of entries.entries()) {
  const payment = payments[index];
  if (!payment) throw new Error('PAYMENT_REQUIRED');
  await bookPayment(payment.journal, payment.id, entry);
}
console.log('M3: register, anchor, close and grant');
const window = await openWindow(business.config, business.account, 8n, 1_500_000n);
const call = (id: string, name: string, args: readonly unknown[]) =>
  sendCall(business, deployment.address, abi, id, name, args);
const register = await call('m3-register', 'registerBook', [plan.salt]);
const anchors: Awaited<ReturnType<typeof sendCall>>[] = [];
for (const entry of entries)
  anchors.push(
    await call(`m3-entry-${entry.period}-${String(entry.index)}`, 'anchorEntry', [
      book,
      contractPeriod(entry.period),
      entry.index,
      entry.blobSha3,
      entry.prevEntrySha3,
    ]),
  );
for (const [index, entry] of entries.entries()) {
  const payment = payments[index];
  const receipt = anchors[index];
  if (!payment || !receipt) throw new Error('ANCHOR_REQUIRED');
  await anchorPayment(payment.journal, payment.id, entry.blobSha3, receipt);
}
const close = closeRecord(
  book,
  plan.a,
  [first, second],
  anchors.slice(0, 2).filter((anchor) => anchor.status === 'success').length,
);
const closeA = { record: close, signature: signHash(hashRecord(close), signer) };
const rawSignature = toHex(
  pqcSign(
    business.account.pqc.secretKey,
    hexToBytes(closeDigest(book, plan.a, hashRecord(close), 9800n, deployment.address)),
  ),
);
const closed = await call('m3-close-a', 'closePeriod', [book, contractPeriod(plan.a), hashRecord(close), rawSignature]);
const grant = await call('m3-grant-a', 'anchorGrant', [
  book,
  contractPeriod(plan.a),
  auditor.account.evm,
  hashRecord(grantA),
]);
const ownerA = await call('m3-self-a', 'anchorGrant', [
  book,
  contractPeriod(plan.a),
  business.account.evm,
  hashRecord(selfA),
]);
const ownerB = await call('m3-self-b', 'anchorGrant', [
  book,
  contractPeriod(plan.b),
  business.account.evm,
  hashRecord(selfB),
]);
const manifest = manifestSchema.parse({
  book,
  contract: deployment.address,
  pool: business.config.pool,
  business: business.account.cosmos,
  periodA: plan.a,
  periodB: plan.b,
  entriesA: [first, second],
  entriesB: [third],
  grantA,
  selfB,
  closeA,
});
writePrivateJson(`${publicDir}/manifest.json`, manifest);
console.log('M3: fresh auditor process');
const result: unknown = JSON.parse(
  execFileSync('pnpm', ['-C', 'packages/chain', 'exec', 'tsx', '../../scripts/m3-auditor.ts'], {
    cwd: m2Root,
    encoding: 'utf8',
    maxBuffer: 1_000_000,
  }),
);
const audit = z
  .object({
    pid: z.number(),
    loadedAccounts: z.array(z.literal('auditor')),
    periodA: z
      .object({
        decryptedEntries: z.literal(2),
        anchorHashesVerified: z.literal(2),
        signaturesVerified: z.literal(2),
        chainVerified: z.literal(true),
        closeVerified: z.literal(true),
      })
      .passthrough(),
    periodB: z.object({ code: z.literal('NOT_GRANTED') }).passthrough(),
  })
  .passthrough()
  .parse(result);
if (audit.pid === process.pid || audit.loadedAccounts.length !== 1) throw new Error('AUDITOR_PROCESS_INVALID');
const evidence = {
  command: 'pnpm evidence --m3',
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: m2Root, encoding: 'utf8' }).trim(),
  at: new Date().toISOString(),
  status: 'PASSED',
  demo: true,
  labels: 'demo-scale periods; all counterparties labelled (demo) inside encrypted entries',
  book,
  contract: deployment.address,
  deployment,
  register,
  window: window.transaction,
  periods: { a: plan.a, b: plan.b },
  entries: entries.map((entry, index) => ({
    period: entry.period,
    index: entry.index,
    blobSha3: entry.blobSha3,
    prevSha3: entry.prevEntrySha3,
    anchor: anchors[index],
  })),
  close: { sha3: hashRecord(close), transaction: closed, precompileVerified: true },
  grants: { auditorA: grant, selfA: ownerA, selfB: ownerB, auditorB: null },
  incoming: {
    window: incoming.window,
    shield: incoming.shield,
    send: incoming.send,
    memo: incoming.memo,
    open: { kind: incoming.open.kind, treeChecked: true },
  },
  auditor: audit,
  doesNotEstablish: [
    'receipt proof verification (M4)',
    'Groth16 post-quantum soundness',
    'payer anonymity',
    'browser behaviour',
    'reconciliation',
  ],
};
assertPublic(evidence, [
  ...accountSecrets(business.account),
  ...accountSecrets(auditor.account),
  ...accountSecrets(client.account),
  ...sealSecrets(business.sealKeys),
  ...sealSecrets(auditor.sealKeys),
  ...sealSecrets(client.sealKeys),
  toHex(keyA.key),
  toHex(keyB.key),
  incoming.note.secret,
  oldNote('m2', 'm2-send').secret,
  oldNote('m2b', 'm2b-send').secret,
]);
writePrivateJson(evidencePath, evidence);
console.log(JSON.stringify(evidence, null, 2));
