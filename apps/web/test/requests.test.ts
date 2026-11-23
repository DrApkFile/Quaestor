import { it, expect, vi } from 'vitest';
import { executeOperation } from '@quaestor/chain/executor';
import type { JournalData } from '@quaestor/chain/journal';
import { depositRequestId } from '../src/business/requests.js';
it('T-JOURNAL an unknown deposit reuses its request and never builds signs or broadcasts again', async () => {
  const operation: JournalData['operations'][number] = {
    id: 'deposit-original',
    requestKey: 'deposit',
    input: null,
    stage: 'OUTCOME_UNKNOWN',
    prepared: { data: '0x', valueWei: '2000000000000000000', outputs: [], root: null, nullifier: null, feeWei: '0' },
    hash: `0x${'11'.repeat(32)}`,
    receipt: null,
    plannedAt: '2026-11-23T00:00:00Z',
    updatedAt: '2026-11-23T00:00:00Z',
  };
  const journal: Parameters<typeof executeOperation>[0] = {
    read: () => ({ v: 1, notes: [], operations: [operation] }),
    save: vi.fn(),
    exclusive: (work) => work(),
  };
  const gateway = {
    windowOpen: vi.fn(() => Promise.resolve(true)),
    sign: vi.fn(() => Promise.reject(new Error('UNEXPECTED_SIGN'))),
    broadcast: vi.fn(() => Promise.reject(new Error('UNEXPECTED_BROADCAST'))),
    receipt: vi.fn(() => Promise.reject(new Error('UNEXPECTED_RECEIPT'))),
    included: vi.fn(() => Promise.resolve(true)),
  };
  const build = vi.fn(() => Promise.reject(new Error('UNEXPECTED_BUILD')));
  const id = depositRequestId(journal.read().operations, 'deposit-new');
  expect(id).toBe(operation.id);
  await expect(executeOperation(journal, { id, input: null, requestKey: 'deposit', build }, gateway)).resolves.toEqual({
    kind: 'OUTCOME_UNKNOWN',
  });
  for (const action of [build, gateway.windowOpen, gateway.sign, gateway.broadcast, journal.save])
    expect(action).not.toHaveBeenCalled();
});
it('T-JOURNAL retrying a prepared token approval preserves the original deposit namespace', () => {
  expect(depositRequestId([{ id: 'deposit-original-approve', stage: 'PROVED' }], 'deposit-new')).toBe(
    'deposit-original',
  );
});
it('A11 a completed deposit allows a new request without reusing an unrelated cash-out', () => {
  expect(
    depositRequestId(
      [
        { id: 'deposit-completed', stage: 'LANDED' },
        { id: 'cashout-held', stage: 'OUTCOME_UNKNOWN' },
      ],
      'deposit-new',
    ),
  ).toBe('deposit-new');
});
