import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPublicClient, http, parseEther, zeroAddress } from 'viem';
import { createPool, createGateway, createProver, dianaChain, Journal, loadAccount, loadPoolAbi,
  parseConfig, paymentEvidence, readEvidence, registerPqcKey, openWindow, saveEvidence, syncPoolTree,
  type ExecutionResult, type RoundtripEvidence } from '../packages/chain/src/index.js';
import { runFusdSpike } from './m1-fusd.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = parseConfig(JSON.parse(readFileSync(`${root}/config/diana.json`, 'utf8')) as unknown);
const reader = createPublicClient({ chain: dianaChain, transport: http(config.evmRpc, { retryCount: 0 }) });
const abi = loadPoolAbi(`${root}/contracts/out/ShieldPoolPayments.sol/ShieldPoolPayments.json`);
const journal = new Journal(`${root}/.accounts/m1/journal.json`);
const business = await loadAccount(`${root}/.accounts`, 'business');
const supplier = await loadAccount(`${root}/.accounts`, 'supplier1');
const provers = {
  shield: createProver(`${root}/apps/web/public/circuits`, 'shield'),
  transfer: createProver(`${root}/apps/web/public/circuits`, 'transfer'),
  unshield: createProver(`${root}/apps/web/public/circuits`, 'unshield'),
};
const pool = (owner: 'business' | 'supplier1') => createPool({ config, reader, abi, journal, owner, provers,
  gateway: createGateway(config, owner === 'business' ? business : supplier, reader, abi) });
const evidencePath = `${root}/evidence/m1-roundtrip.json`;
async function balance() {
  const block = await reader.getBlockNumber({ cacheTime: 0 });
  return { block: block.toString(), wei: (await reader.getBalance({ address: supplier.evm as `0x${string}`, blockNumber: block })).toString() };
}
if (await reader.getChainId() !== 9800) throw new Error('CHAIN_MISMATCH');
const now = new Date().toISOString();
const evidence: RoundtripEvidence = readEvidence(evidencePath) ?? {
  v: 1, command: 'pnpm evidence --m1', commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  network: 'qorechain-diana', chainId: 9800, pool: config.pool, demo: true, asset: 'native QOR',
  proofSystem: 'Groth16 BN254; not post-quantum', status: 'RUNNING', startedAt: now, updatedAt: now,
  supplier: supplier.evm as `0x${string}`, before: await balance(), beforeUnshield: null, after: null,
  nativeTransactions: [], payments: [], tree: null, balanceCheck: null, fusd: null, errorCode: null,
};
const save = () => {
  const serialized = JSON.stringify(evidence);
  const secrets = [business.privateKey, business.mnemonic, supplier.privateKey, supplier.mnemonic,
    ...journal.read().notes.map(note => note.secret)].filter((value): value is string => typeof value === 'string');
  if (secrets.some(secret => serialized.includes(secret))) throw new Error('SECRET_IN_EVIDENCE');
  saveEvidence(evidencePath, evidence);
};
function record(result: ExecutionResult) {
  if (result.kind !== 'LANDED') throw new Error(result.kind);
  const item = paymentEvidence(result.operation);
  evidence.payments = [...evidence.payments.filter(payment => payment.id !== item.id), item];
  save();
  console.log(JSON.stringify({ id: item.id, hash: item.hash, block: item.blockNumber, gasUsed: item.gasUsed }));
  return result.operation;
}
async function run() {
  if (evidence.status === 'PASSED') {
    console.log('M1 already passed; retaining the recorded round trip.');
    return;
  }
  save();
  for (const operation of journal.read().operations) {
    if (operation.stage === 'BROADCAST' || operation.stage === 'OUTCOME_UNKNOWN') {
      record(await pool(operation.id === 'unshield' ? 'supplier1' : 'business').resolve(operation.id));
    }
  }
  for (const [role, account] of [['business', business], ['supplier1', supplier]] as const) {
    const registered = await registerPqcKey(config, account);
    if (registered.kind === 'REGISTERED') {
      evidence.nativeTransactions.push({ action: `register-${role}`, ...registered.transaction, feeUqor: '100000' });
      save();
    }
    const ids = role === 'business' ? ['shield', 'send'] : ['unshield'];
    const remaining = ids.filter(id => !journal.read().operations.some(item => item.id === id && item.stage === 'LANDED')).length;
    if (remaining > 0) {
      const value = role === 'business' ? 6_500_000n : 750_000n;
      const opened = await openWindow(config, account, BigInt(remaining), value);
      evidence.nativeTransactions.push({ action: `window-${role}`, ...opened.transaction, feeUqor: '100000' });
      save();
      if (opened.status.kind !== 'OPEN') throw new Error('WINDOW_CLOSED');
    }
  }
  const shield = record(await pool('business').shield('shield', zeroAddress, parseEther('5')));
  const shieldNote = shield.prepared?.outputs[0];
  if (!shieldNote) throw new Error('NOTE_REQUIRED');
  const send = record(await pool('business').privateSend('send', shieldNote.commitment, parseEther('2'), 'supplier1'));
  const payment = send.prepared?.outputs.find(note => note.owner === 'supplier1');
  if (!payment) throw new Error('NOTE_REQUIRED');
  if (!evidence.beforeUnshield) { evidence.beforeUnshield = await balance(); save(); }
  const unshield = record(await pool('supplier1').unshield('unshield', payment.commitment, supplier.evm as `0x${string}`));
  evidence.after = await balance();
  if (!unshield.receipt || !unshield.prepared) throw new Error('RECEIPT_REQUIRED');
  const expectedDelta = parseEther('2') - BigInt(unshield.prepared.feeWei)
    - BigInt(unshield.receipt.gasUsed) * BigInt(unshield.receipt.effectiveGasPrice);
  const actualDelta = BigInt(evidence.after.wei) - BigInt(evidence.beforeUnshield.wei);
  evidence.balanceCheck = { expectedDeltaWei: expectedDelta.toString(), actualDeltaWei: actualDelta.toString(), passed: expectedDelta === actualDelta };
  save();
  if (!evidence.balanceCheck.passed) throw new Error('BALANCE_MISMATCH');
  const synced = await syncPoolTree(reader, config, abi, BigInt(evidence.after.block));
  evidence.tree = { block: synced.block.toString(), root: synced.tree.root, leafCount: synced.tree.leafCount,
    requestedRange: config.chunkSize.toString(), effectiveRange: synced.logRange.toString() };
  save();
  evidence.fusd = await runFusdSpike(config, business, reader, evidence, save);
  evidence.status = 'PASSED';
  evidence.errorCode = null;
  save();
  console.log(JSON.stringify({ status: evidence.status, before: evidence.before, beforeUnshield: evidence.beforeUnshield,
    after: evidence.after, balanceCheck: evidence.balanceCheck, tree: evidence.tree, fusd: evidence.fusd }, null, 2));
}
try { await run(); }
catch (error: unknown) {
  evidence.status = 'FAILED';
  const message = error instanceof Error ? error.message : '';
  evidence.errorCode = /^[A-Z_]+$/.test(message) ? message : 'RUN_FAILED';
  save();
  saveEvidence(`${root}/evidence/m1-failure-${Date.now()}.json`, evidence);
  console.error(JSON.stringify({ status: 'FAILED', errorCode: evidence.errorCode, journal: '.accounts/m1/journal.json' }));
  process.exitCode = 1;
}
