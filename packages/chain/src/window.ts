import { evmWindowStatus, type EvmWindow } from '@qorechain/evm';
import { openEvmWindowMsg, type UnifiedAccount } from '@qorechain/sdk';
import type { ChainConfig } from './config.js';
import { broadcastNative } from './native.js';

export type WindowResult = { kind: 'OPEN'; window: EvmWindow } | { kind: 'WINDOW_CLOSED' };
export async function checkWindow(config: ChainConfig, address: string): Promise<WindowResult> {
  const window = await evmWindowStatus({ rest: config.rest, address });
  return window.live ? { kind: 'OPEN', window } : { kind: 'WINDOW_CLOSED' };
}
export async function openWindow(config: ChainConfig, account: UnifiedAccount, maxTxs: bigint, maxValue: bigint) {
  const message = openEvmWindowMsg({ sender: account.cosmos, blocks: 600n, maxTxs, maxValue });
  const transaction = await broadcastNative(config, account, 'hybrid', [message]);
  return { transaction, status: await checkWindow(config, account.cosmos) };
}
