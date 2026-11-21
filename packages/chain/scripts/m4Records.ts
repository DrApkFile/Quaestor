import { existsSync } from 'node:fs';
import { z } from 'zod';
import { pqcSign } from '@qorechain/sdk';
import { buildFundsWitness } from '@gloamtrade/sdk';
import { groth16 } from 'snarkjs';
import { hexToBytes, toHex, zeroAddress, type Hex } from 'viem';
import {
  artifactSchema,
  sealEntry,
  closeDigestV2,
  holdingsContext,
  fundsSchema,
  verifyProof,
  hashRecord,
  contractPeriod,
  sealLegacyRecord,
  sealedRecordSchema,
  type EpochKey,
  type Entry,
  type Balances,
  type HoldingsClose,
} from '@quaestor/core';
import { m4Dir, m4Public } from './m4State.js';
import { readJson, signingKeys, artifact, sendCall } from './m3Shared.js';
import { m2Root, type M2Context } from './m2Context.js';
import { receiptProof } from './m3Receipt.js';
import { writePrivateJson } from '../src/storage.js';
import type { StoredNote } from '../src/journal.js';
import { syncPoolTree, requireNotePath } from '../src/tree.js';
import { loadPoolAbi } from '../src/abi.js';
export async function entryM4(
  context: M2Context,
  note: StoredNote,
  book: Hex,
  period: string,
  index: number,
  prev: Hex,
  direction: 'IN' | 'OUT',
  counterparty: string,
  key: EpochKey,
  label: string,
) {
  const path = `${m4Public}/${label}-entry-${period}-${String(index)}.json`;
  if (existsSync(path)) return artifactSchema.parse(readJson(path));
  const receipt = await receiptProof(context, note, book, period, index);
  const entry: Entry = {
    v: 1,
    book,
    period,
    index,
    prevEntrySha3: prev,
    direction,
    asset: note.asset,
    amount: note.amountWei,
    paymentCommitment: note.commitment,
    counterparty: { address: counterparty, name: direction === 'IN' ? 'Client (demo)' : 'Supplier (demo)' },
    purpose: 'Private payment (demo)',
    category: 'operations',
    notes: 'Demo-scale period',
    receipt,
  };
  const sealed = sealEntry(entry, key, signingKeys(context), context.config.pool);
  writePrivateJson(path, sealed);
  return sealed;
}
export const fundsResultSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('PROVED'), proof: fundsSchema }).strict(),
  z
    .object({
      kind: z.literal('BLOCKED'),
      code: z.enum(['INSUFFICIENT_SELECTED_HOLDINGS', 'CONSOLIDATION_REQUIRED', 'WITNESS_BLOCKED']),
    })
    .strict(),
]);
export async function fundsM4(
  context: M2Context,
  notes: StoredNote[],
  balances: Balances,
  book: Hex,
  period: string,
  label: string,
) {
  const path = `${m4Dir}/${label}-funds.json`;
  if (existsSync(path)) return fundsResultSchema.parse(readJson(path));
  if (notes.length > 4) return fundsResultSchema.parse({ kind: 'BLOCKED', code: 'CONSOLIDATION_REQUIRED' });
  const block = await context.reader.getBlockNumber({ cacheTime: 0 });
  const { tree } = await syncPoolTree(context.reader, context.config, context.poolAbi, block);
  const inputs = [];
  for (const note of notes)
    inputs.push({
      secretHex: note.secret,
      amount: BigInt(note.amountWei),
      path: await requireNotePath(tree, note.commitment),
    });
  const threshold = balances[zeroAddress];
  if (threshold === undefined) throw new Error('ASSET_REQUIRED');
  const witness = await buildFundsWitness({
    asset: zeroAddress,
    threshold: BigInt(threshold),
    context: holdingsContext(book, period, context.config.pool),
    notes: inputs,
  });
  const base = `${m2Root}/apps/web/public/circuits`;
  const result = witness.blocker
    ? fundsResultSchema.parse({
        kind: 'BLOCKED',
        code: witness.total < BigInt(threshold) ? 'INSUFFICIENT_SELECTED_HOLDINGS' : 'WITNESS_BLOCKED',
      })
    : fundsResultSchema.parse({
        kind: 'PROVED',
        proof: await groth16.fullProve(
          witness.circomInput,
          `${base}/funds.wasm`,
          `${base}/funds_final.zkey`,
          undefined,
          undefined,
          { singleThread: true },
        ),
      });
  if (result.kind === 'PROVED' && !(await verifyProof(readJson(`${base}/funds_vkey.json`), result.proof)))
    throw new Error('FUNDS_PROOF_INVALID');
  writePrivateJson(path, result);
  return result;
}
export function recordM4(context: M2Context, record: unknown, key: EpochKey, label: string, book: Hex) {
  return artifact(`${m4Public}/${label}.json`, sealedRecordSchema, () =>
    sealLegacyRecord(record, key, signingKeys(context), `quaestor:${book}:${label}`),
  );
}
export async function closeM4(context: M2Context, contract: Hex, record: HoldingsClose, id: string) {
  const signature = artifact(
    `${m4Dir}/${id}-signature.json`,
    z
      .object({
        hex: z
          .string()
          .regex(/^0x[\da-f]+$/)
          .transform((v) => v as Hex),
      })
      .strict(),
    () => ({
      hex: toHex(
        pqcSign(
          context.account.pqc.secretKey,
          hexToBytes(
            closeDigestV2(
              record.book,
              record.period,
              record.entryCount,
              record.lastEntrySha3,
              hashRecord(record),
              9800n,
              contract,
            ),
          ),
        ),
      ),
    }),
  );
  return sendCall(context, contract, loadPoolAbi(`${m2Root}/contracts/out/Books.sol/Books.json`), id, 'closePeriod', [
    record.book,
    contractPeriod(record.period),
    record.entryCount,
    record.lastEntrySha3,
    hashRecord(record),
    signature.hex,
  ]);
}
