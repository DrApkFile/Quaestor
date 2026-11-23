import { formatUnits } from 'viem';
import { weiToUqorCeil } from '@qorechain/evm';
import { checkWindow } from '@quaestor/chain/browser';
import { browserChain, client } from './client.js';
import type { Gateway } from '@quaestor/chain/executor';
import type { UnifiedAccount } from '@qorechain/sdk';
export interface WindowPlan {
  operations: number;
  valueWei: bigint;
}
const fee = 250000000000n;
export function automaticWindow(
  gateway: Gateway,
  account: UnifiedAccount,
  destination: `0x${string}`,
  plan: () => WindowPlan,
  open: (operations: number, maxValue: bigint) => Promise<unknown>,
): Gateway {
  return {
    ...gateway,
    windowOpen: () => Promise.resolve(true),
    async sign(prepared) {
      const { gasLimitForEstimate } = await import('@quaestor/chain/browser');
      const block = await client.getBlockNumber({ cacheTime: 0 });
      const estimated = await client.estimateGas({
        account: account.evm as `0x${string}`,
        to: destination,
        data: prepared.data,
        value: BigInt(prepared.valueWei),
        blockNumber: block,
        maxFeePerGas: fee,
        maxPriorityFeePerGas: 1000000000n,
      });
      const pending = plan();
      const operations = Math.max(1, pending.operations);
      const gas = gasLimitForEstimate(estimated);
      const maxValue = weiToUqorCeil(
        (pending.valueWei > BigInt(prepared.valueWei) ? pending.valueWei : BigInt(prepared.valueWei)) +
          (gas + BigInt(operations - 1) * 3000000n) * fee,
      );
      const window = await checkWindow(browserChain, account.cosmos);
      if (
        window.kind !== 'OPEN' ||
        window.window.nativeOnly ||
        window.window.remainingTxs < BigInt(operations) ||
        window.window.remainingValue < maxValue ||
        (window.window.allowedTargets.length > 0 &&
          !window.window.allowedTargets.some((target) => target.toLowerCase() === destination.toLowerCase()))
      ) {
        if (
          !globalThis.confirm(
            `This needs a transaction window: about ${String(operations)} transactions, up to ${formatUnits(maxValue + 100000n, 6)} QOR including fees`,
          )
        )
          throw new Error('WINDOW_CLOSED');
        await open(operations, maxValue);
      }
      const signed = await gateway.sign(prepared);
      pending.operations = Math.max(0, pending.operations - 1);
      pending.valueWei =
        pending.valueWei > BigInt(prepared.valueWei) ? pending.valueWei - BigInt(prepared.valueWei) : 0n;
      return signed;
    },
  };
}
