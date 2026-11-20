import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPublicClient, encodeFunctionData, erc20Abi, http } from 'viem';
import { createPool, createGateway, createProver, dianaChain, executeOperation, Journal, loadAccount, loadPoolAbi,
  parseConfig, paymentEvidence, openWindow, broadcastNative, NativeBroadcastError, accountSecrets } from '../packages/chain/src/index.js';
import { runFusdConversion } from '../packages/chain/scripts/fusd.js';
import { fusdSnapshot, saveFusdEvidence, type FusdEvidence } from '../packages/chain/scripts/fusdEvidence.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const path = `${root}/evidence/m1b-fusd.json`;
if (existsSync(path)) throw new Error('FUSD_EVIDENCE_ALREADY_EXISTS');
const config = parseConfig(JSON.parse(readFileSync(`${root}/config/diana.json`, 'utf8')) as unknown);
const reader = createPublicClient({ chain: dianaChain, transport: http(config.evmRpc, { retryCount: 0 }) });
if (await reader.getChainId() !== config.chainId) throw new Error('CHAIN_MISMATCH');
const business = await loadAccount(`${root}/.accounts`, 'business');
const deployer = await loadAccount(`${root}/.accounts`, 'deployer');
const journal = new Journal(`${root}/.accounts/m1/journal.json`);
const now = new Date().toISOString();
const evidence: FusdEvidence = {
  command: 'pnpm evidence --m1b-fusd', commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  startedAt: now, updatedAt: now, demo: true, stage: 'STARTED', initial: await fusdSnapshot(config, reader, business, deployer),
  afterFunding: null, final: null, funding: null, conversionTransaction: null, window: null, conversion: null,
  approval: null, shield: null, failure: null, errorCode: null,
};
const save = () => saveFusdEvidence(path, evidence, [...accountSecrets(business), ...accountSecrets(deployer),
  ...journal.read().notes.map(note => note.secret)]);
async function run() {
  save();
  if (BigInt(evidence.initial.deployerBank) < 100_000_000n) throw new Error('DEPLOYER_FUSD_BALANCE_TOO_LOW');
  evidence.funding = await broadcastNative(config, deployer, 'hybrid', [{ typeUrl: '/cosmos.bank.v1beta1.MsgSend',
    value: { fromAddress: deployer.cosmos, toAddress: business.cosmos,
      amount: [{ denom: `erc20:${config.fusd}`, amount: '100000000' }] } }]);
  evidence.afterFunding = await fusdSnapshot(config, reader, business, deployer);
  if (BigInt(evidence.afterFunding.businessBank) - BigInt(evidence.initial.businessBank) !== 100_000_000n) throw new Error('FUNDING_BALANCE_MISMATCH');
  evidence.stage = 'FUNDED';
  save();
  evidence.conversion = await runFusdConversion(config, business, reader, transaction => {
    evidence.conversionTransaction = transaction;
    save();
  });
  evidence.final = await fusdSnapshot(config, reader, business, deployer);
  if (evidence.conversion.status !== 'CONVERTED') {
    evidence.stage = 'CONVERSION_FAILED';
    save();
    return;
  }
  evidence.stage = 'CONVERTED';
  save();
  const abi = loadPoolAbi(`${root}/contracts/out/ShieldPoolPayments.sol/ShieldPoolPayments.json`);
  const opened = await openWindow(config, business, 2n, 1_500_000n);
  evidence.window = opened.transaction;
  save();
  if (opened.status.kind !== 'OPEN') throw new Error('WINDOW_CLOSED');
  const gateway = createGateway(config, business, reader, abi);
  const approvalGateway = { ...createGateway(config, business, reader, abi, config.fusd), included: async () => true };
  const approval = await executeOperation(journal, { id: 'fusd-approve-fifty', input: null,
    requestKey: JSON.stringify([9800, config.fusd, config.pool, business.evm, 'approve', '50000000']),
    build: async () => ({ data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [config.pool, 50_000_000n] }),
      valueWei: '0', root: null, nullifier: null, feeWei: '0', outputs: [] }),
  }, approvalGateway);
  if (approval.kind !== 'LANDED') throw new Error(approval.kind);
  evidence.approval = paymentEvidence(approval.operation);
  evidence.stage = 'APPROVED';
  save();
  const pool = createPool({ config, reader, abi, journal, gateway, owner: 'business', provers: {
    shield: createProver(`${root}/apps/web/public/circuits`, 'shield'),
    transfer: createProver(`${root}/apps/web/public/circuits`, 'transfer'),
    unshield: createProver(`${root}/apps/web/public/circuits`, 'unshield'),
  } });
  const shield = await pool.shield('fusd-shield-fifty', config.fusd, 50_000_000n);
  if (shield.kind !== 'LANDED') throw new Error(shield.kind);
  evidence.shield = paymentEvidence(shield.operation);
  evidence.final = await fusdSnapshot(config, reader, business, deployer);
  if (BigInt(evidence.conversion.after ?? '0') - BigInt(evidence.final.businessToken) !== 50_000_000n) throw new Error('SHIELD_BALANCE_MISMATCH');
  evidence.stage = 'SHIELDED';
  save();
}
try { await run(); }
catch (error: unknown) {
  evidence.stage = 'FAILED';
  if (error instanceof NativeBroadcastError) { evidence.failure = error.fields(); evidence.errorCode = error.kind; }
  else {
    const message = error instanceof Error ? error.message : '';
    evidence.errorCode = /^[A-Z_]+$/.test(message) ? message : 'FUSD_RUN_FAILED';
  }
  save();
  process.exitCode = 1;
}
console.log(JSON.stringify(evidence, null, 2));
