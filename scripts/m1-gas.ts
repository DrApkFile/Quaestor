import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPublicClient, http, zeroAddress } from 'viem';
import { createPool, createGateway, createProver, dianaChain, Journal, loadAccount, loadPoolAbi,
  parseConfig, paymentEvidence, openWindow } from '../packages/chain/src/index.js';
import { writePrivateJson } from '../packages/chain/src/storage.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const path = `${root}/evidence/m1-gas.json`;
if (existsSync(path)) throw new Error('GAS_EVIDENCE_ALREADY_EXISTS');
const config = parseConfig(JSON.parse(readFileSync(`${root}/config/diana.json`, 'utf8')) as unknown);
const reader = createPublicClient({ chain: dianaChain, transport: http(config.evmRpc, { retryCount: 0 }) });
const account = await loadAccount(`${root}/.accounts`, 'business');
const abi = loadPoolAbi(`${root}/contracts/out/ShieldPoolPayments.sol/ShieldPoolPayments.json`);
const journal = new Journal(`${root}/.accounts/m1/journal.json`);
const pool = createPool({ config, reader, abi, journal, owner: 'business',
  gateway: createGateway(config, account, reader, abi), provers: {
    shield: createProver(`${root}/apps/web/public/circuits`, 'shield'),
    transfer: createProver(`${root}/apps/web/public/circuits`, 'transfer'),
    unshield: createProver(`${root}/apps/web/public/circuits`, 'unshield'),
  } });
const id = 'gas-shield-one-qor';
const existing = journal.read().operations.find(operation => operation.id === id);
const held = existing?.stage === 'BROADCAST' || existing?.stage === 'OUTCOME_UNKNOWN';
const window = held || existing?.stage === 'LANDED' ? null : await openWindow(config, account, 1n, 1_750_000n);
if (window && window.status.kind !== 'OPEN') throw new Error('WINDOW_CLOSED');
const result = held ? await pool.resolve(id) : await pool.shield(id, zeroAddress, 1_000_000_000_000_000_000n);
if (result.kind !== 'LANDED') throw new Error(result.kind);
const payment = paymentEvidence(result.operation);
if (!payment.gas) throw new Error('SIGNED_GAS_REQUIRED');
const feePaidWei = BigInt(payment.gasUsed) * BigInt(payment.effectiveGasPrice);
const evidence = {
  command: 'pnpm evidence --m1-gas', commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  at: new Date().toISOString(), demo: true, network: config.nativeChainId, pool: config.pool,
  amountWei: '1000000000000000000', window: window?.transaction ?? null, payment, feePaidWei: feePaidWei.toString(),
  halfGasLimit: (BigInt(payment.gas.gasLimit) / 2n).toString(),
  chargedExactlyHalfLimit: BigInt(payment.gasUsed) * 2n === BigInt(payment.gas.gasLimit),
  chargedAtLeastHalfLimit: BigInt(payment.gasUsed) * 2n >= BigInt(payment.gas.gasLimit),
};
writePrivateJson(path, evidence);
console.log(JSON.stringify(evidence, null, 2));
