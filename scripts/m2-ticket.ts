import { execFileSync } from 'node:child_process';
import { m2Context, m2Root } from '../packages/chain/scripts/m2Context.js';
import { onboardM2 } from '../packages/chain/scripts/m2Onboard.js';
import { payM2 } from '../packages/chain/scripts/m2Pay.js';
import { launchM2Worker, readM2WorkerProgress } from '../packages/chain/scripts/m2Child.js';
import { loadM2Evidence, saveM2Evidence, type M2Evidence } from '../packages/chain/scripts/m2Evidence.js';
import { accountSecrets, NativeBroadcastError } from '../packages/chain/src/nativeError.js';
import { sealSecrets } from '../packages/chain/src/tickets/sealKeys.js';
import { Journal } from '../packages/chain/src/journal.js';
import { writePrivateJson } from '../packages/chain/src/storage.js';

const path = `${m2Root}/evidence/m2-ticket.json`;
const now = new Date().toISOString();
const evidence: M2Evidence = loadM2Evidence(path) ?? {
  v: 1, command: 'pnpm evidence --m2', commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: m2Root, encoding: 'utf8' }).trim(),
  startedAt: now, updatedAt: now, demo: true, status: 'RUNNING', payerPid: process.pid, payerJournal: '.accounts/m2/business.json',
  nativeTransactions: [], identities: [], importedCommitment: null, payment: null, ticket: null, memo: null,
  supplier: null, client: null, failure: null, registryReason: null, errorCode: null,
};
const secrets: string[] = [];
const save = () => {
  const journal = new Journal(`${m2Root}/.accounts/m2/business.json`, 'business').read();
  const noteSecrets = [...journal.notes.map(note => note.secret), ...journal.operations.flatMap(operation => operation.prepared?.outputs.map(note => note.secret) ?? [])];
  saveM2Evidence(path, evidence, [...secrets, ...noteSecrets]);
};
async function run() {
  if (evidence.status === 'PASSED') { console.log('M2 already passed; keeping its observed evidence.'); return; }
  evidence.status = 'RUNNING'; evidence.errorCode = null; evidence.failure = null; evidence.registryReason = null;
  evidence.payerPid = process.pid;
  const business = await m2Context('business');
  secrets.push(...accountSecrets(business.account), ...sealSecrets(business.sealKeys));
  save();
  for (const role of ['business', 'supplier1', 'auditor', 'client'] as const) {
    const context = role === 'business' ? business : await m2Context(role);
    secrets.push(...accountSecrets(context.account), ...sealSecrets(context.sealKeys));
    await onboardM2(context, evidence, save);
    console.log(JSON.stringify({ role, registry: 'CONFIRMED', card: role === 'client' ? 'NOT_REQUIRED' : 'VERIFIED' }));
  }
  const payee = evidence.identities.find(identity => identity.role === 'supplier1');
  if (!payee) throw new Error('PAYEE_REQUIRED');
  await payM2(business, payee.address, evidence, save);
  secrets.push(...business.journal.read().operations.flatMap(operation => operation.prepared?.outputs.map(note => note.secret) ?? []));
  if (!evidence.ticket || !evidence.memo) throw new Error('MEMO_REQUIRED');
  console.log(JSON.stringify({ memo: evidence.memo.hash, ticketBytes: evidence.ticket.bytes, mode: evidence.ticket.mode }));
  evidence.supplier = await launchM2Worker('supplier1', evidence.ticket.commitment, evidence.memo.hash); save();
  evidence.client = await launchM2Worker('client', evidence.ticket.commitment, evidence.memo.hash); save();
  if (evidence.supplier.openCode !== 'OPENED' || !evidence.supplier.treeIncluded || !evidence.supplier.unshield ||
    evidence.supplier.balanceMatched !== true || !evidence.supplier.journalInitiallyEmpty ||
    evidence.client.openCode !== 'NOT_A_RECIPIENT' || evidence.client.notesAfterScan !== 0 ||
    !evidence.client.journalInitiallyEmpty || evidence.supplier.pid === evidence.payerPid ||
    evidence.client.pid === evidence.payerPid || evidence.supplier.pid === evidence.client.pid) throw new Error('M2_ASSERTION_FAILED');
  evidence.status = 'PASSED'; evidence.errorCode = null; save();
  console.log(JSON.stringify({ status: evidence.status, payment: evidence.payment?.hash, memo: evidence.memo.hash,
    unshield: evidence.supplier.unshield.hash, ticket: evidence.ticket,
    supplier: evidence.supplier, client: evidence.client }, null, 2));
}
try { await run(); }
catch (error: unknown) {
  evidence.status = 'FAILED';
  evidence.supplier = evidence.supplier ?? readM2WorkerProgress('supplier1');
  evidence.client = evidence.client ?? readM2WorkerProgress('client');
  if (error instanceof NativeBroadcastError) { evidence.failure = error.fields(); evidence.errorCode = error.kind; }
  else { const message = error instanceof Error ? error.message : ''; evidence.errorCode = /^[A-Z_]+$/.test(message) ? message : 'M2_RUN_FAILED'; }
  save();
  writePrivateJson(`${m2Root}/evidence/m2-failure-${Date.now()}.json`, evidence);
  console.error(JSON.stringify({ status: 'FAILED', errorCode: evidence.errorCode, failure: evidence.failure, registryReason: evidence.registryReason }));
  process.exitCode = 1;
}
