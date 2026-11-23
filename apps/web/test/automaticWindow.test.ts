import { it, expect, vi, beforeEach } from 'vitest';
import type { UnifiedAccount } from '@qorechain/sdk';
import type { Gateway } from '@quaestor/chain/executor';
const mocks = vi.hoisted(() => ({ estimate: vi.fn(), window: vi.fn(), events: [] as string[] }));
vi.mock('../src/client.js', () => ({
  browserChain: {},
  client: {
    getBlockNumber: () => Promise.resolve(1n),
    estimateGas: mocks.estimate,
  },
}));
vi.mock('@quaestor/chain/browser', () => ({
  checkWindow: mocks.window,
  gasLimitForEstimate: (gas: bigint) => (gas * 5n + 3n) / 4n,
}));
import { automaticWindow } from '../src/automaticWindow.js';
const destination = '0x1111111111111111111111111111111111111111';
const account = { cosmos: 'qor1-test', evm: destination } as UnifiedAccount;
const prepared = {
  data: '0x' as const,
  valueWei: '2000000000000000000',
  outputs: [],
  root: null,
  nullifier: null,
  feeWei: '0',
};
const signed = { serialized: '0x01' as const, hash: '0x02' as const };
function setup() {
  const gateway: Gateway = {
    windowOpen: () => Promise.resolve(false),
    sign: () => {
      mocks.events.push('sign-with-budget-check-and-nonce');
      return Promise.resolve(signed);
    },
    broadcast: () => Promise.resolve(signed.hash),
    receipt: () => Promise.reject(new Error('UNUSED')),
    included: () => Promise.resolve(true),
  };
  const open = vi.fn(() => {
    mocks.events.push('open');
    return Promise.resolve();
  });
  const plan = { operations: 2, valueWei: 2000000000000000000n };
  return { gateway: automaticWindow(gateway, account, destination, () => plan, open), open, plan };
}
beforeEach(() => {
  mocks.events.length = 0;
  mocks.estimate.mockResolvedValue(1000000n);
  mocks.window.mockResolvedValue({ kind: 'CLOSED' });
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
});
it('A11 estimated margin plus remaining-operation caps opens before signing and reading the nonce', async () => {
  const { gateway, open, plan } = setup();
  await expect(gateway.sign(prepared)).resolves.toEqual(signed);
  expect(open).toHaveBeenCalledWith(2, 3062500n);
  expect(globalThis.confirm).toHaveBeenCalledWith(
    'This needs a transaction window: about 2 transactions, up to 3.1625 QOR including fees',
  );
  expect(mocks.events).toEqual(['open', 'sign-with-budget-check-and-nonce']);
  expect(plan).toEqual({ operations: 1, valueWei: 0n });
});
it('A11 declined window never signs or broadcasts', async () => {
  vi.stubGlobal('confirm', () => false);
  const { gateway, open } = setup();
  await expect(gateway.sign(prepared)).rejects.toThrow('WINDOW_CLOSED');
  expect(open).not.toHaveBeenCalled();
  expect(mocks.events).toEqual([]);
});
it('A11 sufficient signed window continues without another confirmation', async () => {
  mocks.window.mockResolvedValue({
    kind: 'OPEN',
    window: { nativeOnly: false, remainingTxs: 5n, remainingValue: 5000000n, allowedTargets: [] },
  });
  const { gateway, open } = setup();
  await gateway.sign(prepared);
  expect(open).not.toHaveBeenCalled();
  expect(globalThis.confirm).not.toHaveBeenCalled();
});
it('T-JOURNAL unknown window broadcast stops before signing', async () => {
  const { gateway } = setup();
  mocks.window.mockRejectedValue(new Error('OUTCOME_UNKNOWN'));
  await expect(gateway.sign(prepared)).rejects.toThrow('OUTCOME_UNKNOWN');
  expect(mocks.events).toEqual([]);
});
