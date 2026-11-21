import { it, expect, vi } from 'vitest';
import { classicalKeyFromPrivate, pqKeyFromSeed, addressFromPublicKey } from '@qorechain/qoresign';
import { sealBatch } from '@qorechain/qoreseal';
import { zeroAddress, toBytes, toHex, type Hex } from 'viem';
import { RECEIPT_PUBLIC_SIGNALS, FUNDS_PUBLIC_SIGNALS } from '@gloamtrade/sdk';
import {
  entryVerdict,
  receiptContext,
  canonical,
  hashBytes,
  signHash,
  periodKey,
  insertionRoots,
  holdingsContext,
  holdingsVerdict,
  closingBalances,
  type Entry,
  type VerdictInput,
  type HoldingsClose,
  type EntryVerdict,
} from '../src/index.js';
const mocked = vi.hoisted(() => ({ verify: vi.fn<() => Promise<boolean>>() }));
vi.mock('snarkjs', () => ({ groth16: { verify: mocked.verify } }));
const classicalKey = classicalKeyFromPrivate(new Uint8Array(32).fill(8), 'eth_secp256k1');
const pqKey = pqKeyFromSeed(new Uint8Array(32).fill(9));
const signer = addressFromPublicKey(classicalKey.publicKey, 'eth_secp256k1').bech32;
const signing = { signer, classicalKey, pqKey };
const book: Hex = `0x${'22'.repeat(32)}`,
  zero: Hex = `0x${'00'.repeat(32)}`;
const key = periodKey(1n, new Uint8Array(32).fill(10));
const entry = (): Entry => ({
  v: 1,
  book,
  period: '2026-11-21',
  index: 0,
  prevEntrySha3: zero,
  direction: 'IN',
  asset: zeroAddress,
  amount: '5',
  paymentCommitment: book,
  counterparty: { address: signer, name: 'Synthetic (demo)' },
  purpose: 'Synthetic (demo)',
  category: 'fixture',
  notes: 'Synthetic fixture; mocked verification',
  receipt: {
    proof: { pi_a: ['0'], pi_b: [['0']], pi_c: ['0'] },
    publicSignals: [
      '7',
      BigInt(book).toString(),
      '0',
      '5',
      '1',
      '5',
      receiptContext(book, '2026-11-21', 0, zeroAddress).toString(),
    ],
  },
});
function input(value = entry()): VerdictInput {
  const batch = sealBatch({
    epochKey: key,
    context: `quaestor:${book}:entry`,
    batchIndex: 0,
    data: toBytes(canonical(value)),
  });
  const digest = hashBytes(batch.blob);
  const artifact = {
    book,
    period: value.period,
    index: 0,
    prevEntrySha3: zero,
    blob: toHex(batch.blob),
    blobSha3: digest,
    signature: signHash(digest, signing),
  };
  return {
    artifact,
    anchor: { book, period: value.period, index: 0, prevSha3: zero, blobSha3: digest },
    key,
    signer,
    pqPublicKey: pqKey.publicKey,
    expectedPrevSha3: zero,
    pool: zeroAddress,
    receiptVkey: { synthetic: true },
    roots: new Set(['7']),
  };
}
it('T-VERDICT SDK receipt and funds public-signal orders are exact', () => {
  expect(RECEIPT_PUBLIC_SIGNALS).toEqual([
    'root',
    'commitment',
    'asset',
    'minAmount',
    'reveal',
    'shownAmount',
    'context',
  ]);
  expect(FUNDS_PUBLIC_SIGNALS).toEqual([
    'root',
    'asset',
    'threshold',
    'context',
    'nullifier0',
    'nullifier1',
    'nullifier2',
    'nullifier3',
  ]);
});
it('T-VERDICT ceiling reaches every entry verdict and reason in precedence order', async () => {
  mocked.verify.mockResolvedValue(true);
  const base = input();
  const artifact = base.artifact;
  if (!artifact) throw new Error('FIXTURE');
  const results: EntryVerdict[] = [];
  results.push(await entryVerdict({ ...base, artifact: null }));
  results.push(await entryVerdict({ ...base, artifact: { ...artifact, blob: '0x00' } }));
  results.push(
    await entryVerdict({
      ...base,
      artifact: {
        ...artifact,
        signature: { ...artifact.signature, pq: { algorithmId: 1, signature: Buffer.alloc(4627).toString('base64') } },
      },
    }),
  );
  results.push(await entryVerdict({ ...base, expectedPrevSha3: book }));
  results.push(await entryVerdict({ ...base, anchor: base.anchor ? { ...base.anchor, index: 1 } : null }));
  results.push(await entryVerdict({ ...base, key: { epoch: 1n, key: new Uint8Array(32).fill(11) } }));
  const wrong = entry();
  wrong.receipt.publicSignals[6] = '0';
  results.push(await entryVerdict(input(wrong)));
  mocked.verify.mockResolvedValueOnce(false);
  results.push(await entryVerdict(base));
  for (const [position, value] of [
    [1, '1'],
    [2, '1'],
    [4, '0'],
    [5, '6'],
  ] as const) {
    const changed = entry();
    changed.receipt.publicSignals[position] = value;
    expect(await entryVerdict(input(changed))).toEqual({ kind: 'UNBACKED', reason: 'MISMATCH' });
  }
  const mismatch = entry();
  mismatch.amount = '6';
  results.push(await entryVerdict(input(mismatch)));
  results.push(await entryVerdict({ ...base, roots: new Set() }));
  mocked.verify.mockRejectedValueOnce(new Error('unavailable'));
  results.push(await entryVerdict(base));
  results.push(await entryVerdict(base));
  expect(results).toEqual([
    { kind: 'UNKNOWN', reason: 'MISSING_INPUTS' },
    { kind: 'TAMPERED', reason: 'ANCHOR_MISMATCH' },
    { kind: 'TAMPERED', reason: 'BAD_SIGNATURE' },
    { kind: 'TAMPERED', reason: 'BROKEN_CHAIN' },
    { kind: 'TAMPERED', reason: 'METADATA_MISMATCH' },
    { kind: 'UNKNOWN', reason: 'NOT_GRANTED' },
    { kind: 'UNBACKED', reason: 'WRONG_CONTEXT' },
    { kind: 'UNBACKED', reason: 'BAD_PROOF' },
    { kind: 'UNBACKED', reason: 'MISMATCH' },
    { kind: 'UNBACKED', reason: 'UNKNOWN_ROOT' },
    { kind: 'UNBACKED', reason: 'BAD_PROOF' },
    { kind: 'MATCHED', reason: 'VERIFIED' },
  ]);
  expect(await entryVerdict({ ...base, artifact: { ...artifact, blob: '0x00' }, key: null })).toEqual({
    kind: 'UNKNOWN',
    reason: 'MISSING_INPUTS',
  });
});
it('T-VERDICT root history retains an old insertion root beyond the last 100 roots', async () => {
  const leaves = Array.from(
    { length: 103 },
    (_, i): Hex =>
      `0x${BigInt(i + 1)
        .toString(16)
        .padStart(64, '0')}`,
  );
  const old = await insertionRoots(leaves.slice(0, 1));
  const history = await insertionRoots(leaves);
  expect(history.size).toBe(103);
  for (const root of old) {
    expect(history.has(root)).toBe(true);
    expect([...history].slice(-100)).not.toContain(root);
    const value = entry();
    value.receipt.publicSignals[0] = root;
    mocked.verify.mockResolvedValue(true);
    expect(await entryVerdict({ ...input(value), roots: history })).toEqual({ kind: 'MATCHED', reason: 'VERIFIED' });
    expect(await entryVerdict({ ...input(value), roots: new Set([...history].slice(-100)) })).toEqual({
      kind: 'UNBACKED',
      reason: 'UNKNOWN_ROOT',
    });
  }
}, 30000);
it('T-HOLDINGS derives declared balances and checks every proof/nullifier before coverage', async () => {
  mocked.verify.mockResolvedValue(true);
  const close: HoldingsClose = {
    v: 1,
    book,
    period: '2026-11-21',
    entryCount: 1,
    lastEntrySha3: book,
    priorSha3: zero,
    closingBalance: { [zeroAddress]: '5' },
    cashOutFees: {},
    holdings: {
      [zeroAddress]: {
        proof: entry().receipt.proof,
        publicSignals: ['7', '0', '5', holdingsContext(book, '2026-11-21', zeroAddress).toString(), '8', '0', '0', '0'],
      },
    },
  };
  const base = {
    close,
    pool: zeroAddress,
    fundsVkey: { synthetic: true },
    roots: new Set(['7']),
    spent: new Map([['8', false]]),
  };
  expect(await holdingsVerdict(base)).toEqual({ kind: 'HOLDINGS_COVER_BOOKS', reason: 'VERIFIED' });
  expect(await holdingsVerdict({ ...base, spent: new Map([['8', true]]) })).toEqual({
    kind: 'UNKNOWN',
    reason: 'SPENT_NULLIFIER',
  });
  expect(await holdingsVerdict({ ...base, spent: new Map() })).toEqual({ kind: 'UNKNOWN', reason: 'MISSING_INPUTS' });
  expect(await holdingsVerdict({ ...base, roots: new Set() })).toEqual({ kind: 'UNKNOWN', reason: 'UNKNOWN_ROOT' });
  expect(await holdingsVerdict({ ...base, close: { ...close, closingBalance: { [zeroAddress]: '6' } } })).toEqual({
    kind: 'HOLDINGS_SHORT',
    reason: 'THRESHOLD_SHORT',
  });
  mocked.verify.mockResolvedValueOnce(false);
  expect(await holdingsVerdict(base)).toEqual({ kind: 'UNKNOWN', reason: 'BAD_PROOF' });
  const proof = close.holdings[zeroAddress];
  if (!proof) throw new Error('FIXTURE');
  const changed = (index: number, value: string) => ({
    ...base,
    close: {
      ...close,
      holdings: {
        [zeroAddress]: {
          ...proof,
          publicSignals: proof.publicSignals.map((signal, i) => (i === index ? value : signal)),
        },
      },
    },
  });
  expect(await holdingsVerdict(changed(3, '0'))).toEqual({ kind: 'UNKNOWN', reason: 'WRONG_CONTEXT' });
  expect(await holdingsVerdict(changed(1, '1'))).toEqual({ kind: 'UNKNOWN', reason: 'MISMATCH' });
  expect(await holdingsVerdict(changed(5, '8'))).toEqual({ kind: 'UNKNOWN', reason: 'MISMATCH' });
  mocked.verify.mockRejectedValueOnce(new Error('verification unavailable'));
  expect(await holdingsVerdict(base)).toEqual({ kind: 'UNKNOWN', reason: 'VERIFICATION_UNAVAILABLE' });
  expect(() => closingBalances({ [zeroAddress]: '1' }, [{ ...entry(), direction: 'OUT', amount: '2' }], {})).toThrow(
    'INVALID_RECORD',
  );
  expect(
    closingBalances({ [zeroAddress]: '10' }, [entry(), { ...entry(), direction: 'OUT', amount: '2' }], {
      [zeroAddress]: '1',
    }),
  ).toEqual({ [zeroAddress]: '12' });
});
