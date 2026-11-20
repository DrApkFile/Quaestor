import { readFileSync } from 'node:fs';
import { parseTransaction, type PublicClient } from 'viem';
import type { UnifiedAccount } from '@qorechain/sdk';
import { beforeEach, expect, it, vi } from 'vitest';
import { gasLimitForEstimate } from '../src/gas.js';
import { parseConfig } from '../src/config.js';
import { createGateway } from '../src/gateway.js';
import { checkWindow } from '../src/window.js';
import { prepared } from './fixtures.js';

vi.mock('../src/window.js', () => ({ checkWindow: vi.fn() }));
const config = parseConfig(JSON.parse(readFileSync(new URL('../../../config/diana.json', import.meta.url), 'utf8')) as unknown);
const account = { privateKey: `0x${'11'.repeat(32)}`, cosmos: 'qor1test' } as unknown as UnifiedAccount;
const window = { kind: 'OPEN', window: { nativeOnly: false, allowedTargets: [], remainingValue: 125_000n } } as const;
beforeEach(() => vi.mocked(checkWindow).mockResolvedValue(window as unknown as Awaited<ReturnType<typeof checkWindow>>));

it('T-GAS rounds 125 percent up and caps the signed limit at three million', () => {
  expect(gasLimitForEstimate(101n)).toBe(127n);
  expect(gasLimitForEstimate(400_000n)).toBe(500_000n);
  expect(gasLimitForEstimate(2_800_000n)).toBe(3_000_000n);
  expect(() => gasLimitForEstimate(3_000_001n)).toThrow('GAS_ESTIMATE_OUT_OF_RANGE');
});
it('T-GAS signs the padded estimate and admits a budget that covers that actual limit', async () => {
  const estimateGas = vi.fn(async () => 400_000n);
  const getTransactionCount = vi.fn(async () => 7);
  const reader = { getChainId: async () => 9800, getBlockNumber: async () => 123n,
    estimateGas, getTransactionCount } as unknown as PublicClient;
  const signed = await createGateway(config, account, reader, []).sign(prepared);
  const transaction = parseTransaction(signed.serialized);
  expect(transaction.gas).toBe(500_000n);
  expect(transaction.nonce).toBe(7);
  expect(transaction.chainId).toBe(9800);
  expect(signed.gas).toEqual({ estimatedGas: '400000', gasLimit: '500000', maxFeePerGas: '250000000000', estimationBlock: '123' });
  expect(estimateGas).toHaveBeenCalledWith(expect.objectContaining({ blockNumber: 123n, to: config.pool }));
  expect(vi.mocked(checkWindow).mock.invocationCallOrder[0]).toBeLessThan(getTransactionCount.mock.invocationCallOrder[0] ?? 0);
});
it('T-GAS refuses an estimated transaction whose actual signed fee cap exceeds the window', async () => {
  vi.mocked(checkWindow).mockResolvedValue({ ...window, window: { ...window.window, remainingValue: 124_999n } } as unknown as Awaited<ReturnType<typeof checkWindow>>);
  const getTransactionCount = vi.fn(async () => 7);
  const reader = { getChainId: async () => 9800, getBlockNumber: async () => 123n,
    estimateGas: async () => 400_000n, getTransactionCount } as unknown as PublicClient;
  await expect(createGateway(config, account, reader, []).sign(prepared)).rejects.toThrow('WINDOW_CLOSED');
  expect(getTransactionCount).not.toHaveBeenCalled();
});
