import { it, expect } from 'vitest';
import type { UnifiedAccount } from '@qorechain/sdk';
import { activateAccount } from '../src/activation.js';
const account = { cosmos: 'qor1-test-activation' } as UnifiedAccount;
const initial = {
  block: '1',
  balance: '10000000000000000000',
  funded: true,
  pqRegistered: false,
  kemRegistered: false,
  cardPublished: false,
  keysMatch: true,
};
it('A11 activation resumes from chain state without repeating a completed registration', async () => {
  const status = { ...initial };
  const calls: string[] = [];
  let fail = true;
  const actions = {
    status: () => Promise.resolve({ ...status }),
    pq: () => {
      calls.push('pq');
      status.pqRegistered = true;
      return Promise.resolve();
    },
    kem: () => {
      calls.push('kem');
      if (fail) {
        fail = false;
        return Promise.reject(new Error('NETWORK_UNAVAILABLE'));
      }
      status.kemRegistered = true;
      return Promise.resolve();
    },
    card: () => {
      calls.push('card');
      status.cardPublished = true;
      return Promise.resolve();
    },
  };
  const record = () => Promise.resolve([]);
  await expect(activateAccount(account, true, () => undefined, actions, record)).rejects.toThrow('NETWORK_UNAVAILABLE');
  await expect(activateAccount(account, true, () => undefined, actions, record)).resolves.toMatchObject({
    cardPublished: true,
  });
  expect(calls).toEqual(['pq', 'kem', 'kem', 'card']);
});
it('T-JOURNAL activation stops on unknown outcomes, mismatched keys or a missing backup', async () => {
  const calls: string[] = [];
  const actions = {
    status: () => Promise.resolve({ ...initial }),
    pq: () => {
      calls.push('pq');
      return Promise.reject(new Error('OUTCOME_UNKNOWN'));
    },
    kem: () => {
      calls.push('kem');
      return Promise.resolve();
    },
    card: () => {
      calls.push('card');
      return Promise.resolve();
    },
  };
  await expect(
    activateAccount(
      account,
      false,
      () => undefined,
      actions,
      () => Promise.resolve([]),
    ),
  ).rejects.toThrow('BACKUP_REQUIRED');
  await expect(
    activateAccount(
      account,
      true,
      () => undefined,
      actions,
      () => Promise.resolve([]),
    ),
  ).rejects.toThrow('OUTCOME_UNKNOWN');
  expect(calls).toEqual(['pq']);
  await expect(
    activateAccount(
      account,
      true,
      () => undefined,
      { ...actions, status: () => Promise.resolve({ ...initial, keysMatch: false }) },
      () => Promise.resolve([]),
    ),
  ).rejects.toThrow('REGISTRY_KEY_MISMATCH');
  expect(calls).toEqual(['pq']);
});
