import { proofContext, readFundsSignals } from '@gloamtrade/sdk';
import type { Address } from 'viem';
import { z } from 'zod';
import { BookError, address, hex32, periodId, uint } from './codec.js';
import { closeSchema } from './period.js';
import type { Entry } from './entry.js';
import { fundsSchema, verifyProof } from './proof.js';

const assetId = z.string().regex(/^0x[\da-fA-F]{40}$/);
export const balancesSchema = z.record(assetId, uint);
export type Balances = z.infer<typeof balancesSchema>;
export const openingSchema = z
  .object({ v: z.literal(1), book: hex32, openingBalance: balancesSchema, at: z.string().datetime() })
  .strict();
export const holdingsCloseSchema = closeSchema
  .extend({
    priorSha3: hex32,
    closingBalance: balancesSchema,
    cashOutFees: balancesSchema,
    holdings: z.record(assetId, fundsSchema.nullable()),
  })
  .strict();
export type HoldingsClose = z.infer<typeof holdingsCloseSchema>;
export const holdingsContext = (book: `0x${string}`, period: string, pool: Address): bigint =>
  proofContext({
    kind: 'funds',
    chainId: 9800,
    pool,
    verifier: `quaestor|holdings|${book}|${periodId.parse(period)}`,
    expiresAt: 0,
  });
export function closingBalances(start: Balances, entries: readonly Entry[], fees: Balances): Balances {
  const totals = new Map(Object.entries(start).map(([asset, value]) => [asset.toLowerCase(), BigInt(value)]));
  for (const entry of entries) {
    const asset = entry.asset.toLowerCase();
    totals.set(asset, (totals.get(asset) ?? 0n) + (entry.direction === 'IN' ? 1n : -1n) * BigInt(entry.amount));
  }
  for (const [asset, value] of Object.entries(fees))
    totals.set(asset.toLowerCase(), (totals.get(asset.toLowerCase()) ?? 0n) - BigInt(value));
  const output: Balances = {};
  for (const [asset, value] of totals) {
    if (value < 0n) throw new BookError('INVALID_RECORD');
    output[address.parse(asset)] = value.toString();
  }
  return output;
}
export type HoldingsVerdict =
  | { kind: 'HOLDINGS_COVER_BOOKS'; reason: 'VERIFIED' }
  | { kind: 'HOLDINGS_SHORT'; reason: 'THRESHOLD_SHORT' }
  | {
      kind: 'UNKNOWN';
      reason:
        | 'MISSING_INPUTS'
        | 'BAD_PROOF'
        | 'WRONG_CONTEXT'
        | 'MISMATCH'
        | 'UNKNOWN_ROOT'
        | 'SPENT_NULLIFIER'
        | 'VERIFICATION_UNAVAILABLE';
    };
export interface HoldingsInput {
  close: HoldingsClose | null;
  pool: Address;
  fundsVkey: unknown;
  roots: ReadonlySet<string> | null;
  spent: ReadonlyMap<string, boolean> | null;
}
export async function holdingsVerdict(input: HoldingsInput): Promise<HoldingsVerdict> {
  const { close, pool, fundsVkey, roots, spent } = input;
  if (!close || !fundsVkey || !roots || !spent || Object.keys(close.closingBalance).length === 0)
    return { kind: 'UNKNOWN', reason: 'MISSING_INPUTS' };
  for (const [asset, amount] of Object.entries(close.closingBalance)) {
    const proof = close.holdings[asset];
    if (!proof) return { kind: 'UNKNOWN', reason: 'MISSING_INPUTS' };
    const signals = readFundsSignals(proof.publicSignals);
    if (signals.context !== holdingsContext(close.book, close.period, pool))
      return { kind: 'UNKNOWN', reason: 'WRONG_CONTEXT' };
    try {
      if (!(await verifyProof(fundsVkey, proof))) return { kind: 'UNKNOWN', reason: 'BAD_PROOF' };
    } catch {
      return { kind: 'UNKNOWN', reason: 'VERIFICATION_UNAVAILABLE' };
    }
    if (signals.asset !== BigInt(asset) || signals.threshold > BigInt(amount))
      return { kind: 'UNKNOWN', reason: 'MISMATCH' };
    if (!roots.has(signals.root.toString())) return { kind: 'UNKNOWN', reason: 'UNKNOWN_ROOT' };
    const nonzero = signals.nullifiers.filter((n) => n !== 0n).map((n) => n.toString());
    if (nonzero.length === 0 || new Set(nonzero).size !== nonzero.length)
      return { kind: 'UNKNOWN', reason: 'MISMATCH' };
    for (const nullifier of nonzero) {
      const state = spent.get(nullifier);
      if (state === undefined) return { kind: 'UNKNOWN', reason: 'MISSING_INPUTS' };
      if (state) return { kind: 'UNKNOWN', reason: 'SPENT_NULLIFIER' };
    }
    if (signals.threshold < BigInt(amount)) return { kind: 'HOLDINGS_SHORT', reason: 'THRESHOLD_SHORT' };
  }
  return { kind: 'HOLDINGS_COVER_BOOKS', reason: 'VERIFIED' };
}
