import { onboardingStatus } from '../onboarding.js';
import { dbGet } from '../db.js';
import { z } from 'zod';
import { openEvmWindowMsg } from '@qorechain/sdk';
import { checkWindow } from '@quaestor/chain/browser';
import { weiToUqorCeil } from '@qorechain/evm';
import { nativeAction } from '../nativeClient.js';
import { BusinessRuntime, browserChain } from './runtime.js';
const maxGasCost = 3000000n * 250000000000n;
export async function prepareWindow(runtime: BusinessRuntime, operations: number, valueWei: bigint, budget?: bigint) {
  if (!Number.isSafeInteger(operations) || operations < 1 || operations > 100) throw new Error('INVALID_WINDOW_PLAN');
  const status = await onboardingStatus(runtime.account);
  if (!status.pqRegistered || !status.kemRegistered || !status.cardPublished || !status.keysMatch)
    throw new Error('REGISTRY_NOT_READY');
  const maxValue = budget ?? weiToUqorCeil(valueWei + BigInt(operations) * maxGasCost);
  await nativeAction(runtime.account, true, `prepare-${crypto.randomUUID()}`, 'hybrid', [
    openEvmWindowMsg({ sender: runtime.account.cosmos, blocks: 600n, maxTxs: BigInt(operations), maxValue }),
  ]);
  const landed = z
    .object({ id: z.string(), hash: z.string(), height: z.number() })
    .passthrough()
    .parse(await dbGet('journal', `native:${runtime.account.cosmos}`));
  if (!runtime.state.nativeTransactions.some((tx) => tx.hash === landed.hash))
    runtime.state.nativeTransactions.push({ id: landed.id, hash: landed.hash, height: landed.height });
  await runtime.save();
  return checkWindow(browserChain, runtime.account.cosmos);
}
export function requireWindow(runtime: BusinessRuntime, operations: number, valueWei = 0n) {
  if (!Number.isSafeInteger(operations) || operations < 1 || operations > 100 || valueWei < 0n)
    throw new Error('INVALID_WINDOW_PLAN');
  runtime.windowPlan = { operations, valueWei };
}
