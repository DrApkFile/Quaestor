import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { createPublicClient, http, formatEther, parseEther } from 'viem';
import { m10NativeReceipt } from './m10-native-receipt.js';
const root = new URL('../', import.meta.url);
const input = readFileSync(new URL('evidence/m10-fresh-signup.json', root));
const uint = z.string().regex(/^\d+$/);
const run = z
  .object({
    status: z.literal('PASSED'),
    uninterruptedFreshSignup: z.literal(true),
    resumedOriginalSignup: z.literal(false),
    freshBrowserContexts: z.literal(true),
    attemptId: z.string().regex(/^m10-\d{13}-[a-f0-9]{16}$/),
    sourceCommit: z.string().regex(/^[a-f0-9]{40}$/),
    address: z.string().regex(/^qor1[a-z0-9]+$/),
    startedAt: z.string().datetime(),
    at: z.string().datetime(),
    elapsedMs: z.number().int().positive(),
    steps: z.array(z.object({ step: z.string(), ms: z.number().int().nonnegative() })),
    activationCostQor: z.string(),
    activationMs: z.number().int().positive(),
    activation: z.array(z.object({ hash: z.string(), block: uint, step: z.string() })).length(4),
    snapshot: z
      .object({
        transactions: z.array(z.object({ id: z.string(), hash: z.string().regex(/^0x[a-f0-9]{64}$/), block: uint })),
        nativeTransactions: z.array(
          z.object({
            id: z.string(),
            hash: z.string().regex(/^[A-Fa-f0-9]{64}$/),
            height: z.number().int().positive(),
          }),
        ),
      })
      .passthrough(),
  })
  .passthrough()
  .parse(JSON.parse(input.toString('utf8')) as unknown);
const immutable = readFileSync(new URL(`evidence/m10-signup-attempts/${run.attemptId}/report.json`, root));
if (!input.equals(immutable)) throw new Error('ATTEMPT_REPORT_MISMATCH');
const config = z
  .object({
    chain: z
      .object({ chainId: z.literal(9800), evmRpc: z.string().url(), consensusRpc: z.string().url() })
      .passthrough(),
  })
  .passthrough()
  .parse(JSON.parse(readFileSync(new URL('config/m5.json', root), 'utf8')) as unknown);
const client = createPublicClient({ transport: http(config.chain.evmRpc, { retryCount: 0 }) });
if ((await client.getChainId()) !== 9800) throw new Error('DIANA_REQUIRED');
const card = run.activation.find((record) => record.step.startsWith('card-'));
if (!card) throw new Error('CARD_RECEIPT_REQUIRED');
const nativeRecords = [
  ...run.activation.filter((record) => record !== card).map((record) => ({ ...record, phase: 'activation' })),
  ...run.snapshot.nativeTransactions.map((record) => ({
    hash: record.hash,
    block: String(record.height),
    step: record.id,
    phase: 'payment',
  })),
];
const evmRecords = [
  { ...card, phase: 'activation' },
  ...run.snapshot.transactions.map((record) => ({
    hash: record.hash,
    block: record.block,
    step: record.id,
    phase: 'payment',
  })),
];
const hashes = [...nativeRecords, ...evmRecords].map((record) => record.hash.toLowerCase());
if (new Set(hashes).size !== hashes.length) throw new Error('DUPLICATE_RECEIPT');
const native: (Awaited<ReturnType<typeof m10NativeReceipt>> & { phase: string })[] = [];
for (const record of nativeRecords)
  native.push({ ...(await m10NativeReceipt(config.chain.consensusRpc, record)), phase: record.phase });
const evm: {
  hash: string;
  block: string;
  step: string;
  phase: string;
  status: 'success';
  gasUsed: string;
  effectiveGasPrice: string;
  feeWei: string;
}[] = [];
for (const record of evmRecords) {
  const hash = z
    .string()
    .regex(/^0x[a-f0-9]{64}$/)
    .parse(record.hash) as `0x${string}`;
  const receipt = await client.getTransactionReceipt({ hash });
  if (receipt.status !== 'success' || receipt.blockNumber.toString() !== record.block)
    throw new Error('EVM_RECEIPT_MISMATCH');
  evm.push({
    ...record,
    hash,
    status: receipt.status,
    gasUsed: receipt.gasUsed.toString(),
    effectiveGasPrice: receipt.effectiveGasPrice.toString(),
    feeWei: (receipt.gasUsed * receipt.effectiveGasPrice).toString(),
  });
}
const fees = (phase?: string) =>
  native
    .filter((record) => !phase || record.phase === phase)
    .reduce((sum, record) => sum + BigInt(record.feeUqor) * 1000000000000n, 0n) +
  evm.filter((record) => !phase || record.phase === phase).reduce((sum, record) => sum + BigInt(record.feeWei), 0n);
if (fees('activation') !== parseEther(run.activationCostQor)) throw new Error('ACTIVATION_COST_MISMATCH');
const target = new URL('evidence/m10-signup-cost.json', root);
if (existsSync(target))
  copyFileSync(target, new URL(`evidence/m10-signup-cost-attempt-${String(Date.now())}.json`, root));
const report = {
  command: 'pnpm evidence --m10-cost',
  status: 'PASSED',
  at: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  attemptId: run.attemptId,
  signupSourceCommit: run.sourceCommit,
  inputSha256: createHash('sha256').update(input).digest('hex'),
  network: 'qorechain-diana',
  chainId: 9800,
  address: run.address,
  startedAt: run.startedAt,
  completedAt: run.at,
  elapsedMs: run.elapsedMs,
  steps: run.steps,
  activationMs: run.activationMs,
  activationQor: formatEther(fees('activation')),
  uiActivationDeltaQor: run.activationCostQor,
  paymentFeesQor: formatEther(fees('payment')),
  totalFeesQor: formatEther(fees()),
  native,
  evm,
  limits:
    'One observed uninterrupted testnet signup. Total elapsed includes manual faucet wait, screenshots, axe, backups and supplier restore. Fees exclude the 2-QOR deposit principal; the 0.5-QOR payment spends that deposit. Gas prices and timings can change. Receipt rereads send no transactions.',
};
writeFileSync(target, JSON.stringify(report, null, 2) + '\n');
console.log(
  `M10 receipts verified: ${String(native.length)} native, ${String(evm.length)} EVM; activation ${report.activationQor} QOR in ${String(run.activationMs)} ms; total fees ${report.totalFeesQor} QOR.`,
);
