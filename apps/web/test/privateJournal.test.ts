import type { Prepared } from '@quaestor/chain/journal';
import { it, expect, vi } from 'vitest';
import { executeOperation, resolveOperation, type Gateway } from '@quaestor/chain/executor';
import { zeroAddress, type Hex } from 'viem';
import { PrivateJournal } from '../src/privateJournal.js';
import type { PrivateStorage } from '../src/privateStore.js';
const hash: Hex = `0x${'22'.repeat(32)}`,
  commitment: Hex = `0x${'33'.repeat(32)}`;
it('T-JOURNAL-BROWSER persists before broadcast and holds unknown spends across reload without rebuilding', async () => {
  const values = new Map<string, unknown>();
  const storage: PrivateStorage = {
    get: (key) => Promise.resolve(structuredClone(values.get(key))),
    put: (key, value) => {
      values.set(key, structuredClone(value));
      return Promise.resolve();
    },
  };
  const journal = await PrivateJournal.open(storage, 'synthetic-demo');
  journal.save({
    v: 1,
    operations: [],
    notes: [
      {
        secret: hash,
        commitment,
        nullifier: hash,
        asset: zeroAddress,
        amountWei: '1',
        owner: 'business',
        state: 'OWNED',
      },
    ],
  });
  await journal.flush();
  const prepared: Prepared = { data: '0x1234', valueWei: '0', root: hash, nullifier: hash, feeWei: '0', outputs: [] };
  const build = vi.fn(() => Promise.resolve(prepared));
  const stages: string[] = [];
  const broadcast = vi.fn(async () => {
    const checkpoint = await PrivateJournal.open(storage, 'synthetic-demo');
    stages.push(checkpoint.read().operations[0]?.stage ?? 'MISSING');
    throw new Error('offline');
  });
  const gateway: Gateway = {
    windowOpen: () => Promise.resolve(true),
    sign: () => Promise.resolve({ serialized: '0x1234', hash }),
    broadcast,
    receipt: () => Promise.reject(new Error('offline')),
    included: () => Promise.resolve(true),
  };
  const request = { id: 'held', requestKey: 'one', input: commitment, build };
  expect(await executeOperation(journal, request, journal.protectGateway(gateway))).toEqual({
    kind: 'OUTCOME_UNKNOWN',
  });
  const reopened = await PrivateJournal.open(storage, 'synthetic-demo');
  expect(reopened.read().notes[0]?.state).toBe('SPENDING');
  expect(await executeOperation(reopened, request, gateway)).toEqual({ kind: 'OUTCOME_UNKNOWN' });
  expect(stages).toEqual(['BROADCAST']);
  expect(build).toHaveBeenCalledTimes(1);
  expect(broadcast).toHaveBeenCalledTimes(1);
  const resolved = await resolveOperation(reopened, 'held', {
    ...gateway,
    receipt: () =>
      Promise.resolve({
        hash,
        blockNumber: '123',
        blockHash: hash,
        gasUsed: '1',
        effectiveGasPrice: '1',
        status: 'success',
      }),
  });
  expect(resolved.kind).toBe('LANDED');
  expect(reopened.read().notes[0]?.state).toBe('SPENT');
  expect(build).toHaveBeenCalledTimes(1);
});
