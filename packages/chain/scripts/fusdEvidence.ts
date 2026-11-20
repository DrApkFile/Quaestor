import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { PublicClient } from 'viem';
import { erc20Abi } from 'viem';
import { uintSchema, type ChainConfig } from '../src/config.js';
import { evidenceSchema } from '../src/evidence.js';
import { nativeFailureSchema } from '../src/nativeError.js';
import { writePrivateJson } from '../src/storage.js';

const transactionSchema = z.object({ hash: z.string().regex(/^[\da-fA-F]{64}$/), height: z.number().int(), gasUsed: uintSchema }).strict();
const snapshotSchema = z.object({ block: uintSchema, businessBank: uintSchema, deployerBank: uintSchema, businessToken: uintSchema }).strict();
export const fusdEvidenceSchema = z.object({
  command: z.literal('pnpm evidence --m1b-fusd'), commit: z.string(), startedAt: z.string().datetime(), updatedAt: z.string().datetime(),
  demo: z.literal(true), stage: z.enum(['STARTED', 'FUNDED', 'CONVERTED', 'APPROVED', 'SHIELDED', 'CONVERSION_FAILED', 'FAILED']),
  initial: snapshotSchema, afterFunding: snapshotSchema.nullable(), final: snapshotSchema.nullable(),
  funding: transactionSchema.nullable(), conversionTransaction: transactionSchema.nullable(), window: transactionSchema.nullable(),
  conversion: evidenceSchema.shape.fusd, approval: evidenceSchema.shape.payments.element.nullable(), shield: evidenceSchema.shape.payments.element.nullable(),
  failure: nativeFailureSchema.nullable(), errorCode: z.string().nullable(),
}).strict();
export type FusdEvidence = z.infer<typeof fusdEvidenceSchema>;
const bankSchema = z.object({ balance: z.object({ denom: z.string(), amount: uintSchema }).strict() }).strict();
export async function fusdSnapshot(config: ChainConfig, reader: PublicClient, business: { cosmos: string; evm: string }, deployer: { cosmos: string }) {
  const block = await reader.getBlockNumber({ cacheTime: 0 });
  const denom = `erc20:${config.fusd}`;
  const bank = async (address: string) => {
    const response = await fetch(`${config.rest}/cosmos/bank/v1beta1/balances/${address}/by_denom?denom=${encodeURIComponent(denom)}`,
      { headers: { 'x-cosmos-block-height': block.toString() } });
    if (!response.ok) throw new Error('BANK_READ_FAILED');
    const body: unknown = await response.json();
    const result = bankSchema.parse(body).balance;
    if (result.denom !== denom) throw new Error('BANK_DENOM_MISMATCH');
    return result.amount;
  };
  const [businessBank, deployerBank, token] = await Promise.all([
    bank(business.cosmos), bank(deployer.cosmos), reader.readContract({ address: config.fusd,
      abi: erc20Abi, functionName: 'balanceOf', args: [business.evm as `0x${string}`], blockNumber: block }),
  ]);
  return { block: block.toString(), businessBank, deployerBank, businessToken: token.toString() };
}
export function saveFusdEvidence(path: string, evidence: FusdEvidence, secrets: readonly string[]) {
  evidence.updatedAt = new Date().toISOString();
  const parsed = fusdEvidenceSchema.parse(evidence);
  const text = JSON.stringify(parsed);
  if (secrets.some(secret => secret.length > 0 && text.includes(secret))) throw new Error('SECRET_IN_EVIDENCE');
  writePrivateJson(path, parsed);
}
export function readFusdEvidence(path: string): FusdEvidence {
  const body: unknown = JSON.parse(readFileSync(path, 'utf8'));
  return fusdEvidenceSchema.parse(body);
}
