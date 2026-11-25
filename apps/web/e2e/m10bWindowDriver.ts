import { deriveUnifiedAccount, openEvmWindowMsg } from '@qorechain/sdk';
import { NativeBroadcastError, checkWindow, createGateway, executeOperation } from '@quaestor/chain/browser';
import { decryptVault } from '../src/vault.js';
import { nativeAction } from '../src/nativeClient.js';
import { dbGet, dbPut } from '../src/db.js';
import { BusinessRuntime, browserChain, client } from '../src/business/runtime.js';
import { z } from 'zod';
const receiptSchema = z.object({ id: z.string(), hash: z.string(), height: z.number(), code: z.number() });
const stateSchema = z
  .object({
    block: z.string(),
    kind: z.string(),
    remainingTxs: z.string(),
    remainingValue: z.string(),
    remainingBlocks: z.string(),
  })
  .strict();
const stepSchema = z.object({ receipt: receiptSchema, state: stateSchema }).strict();
export async function spikeProgress(address: string) {
  const key = `m10b-window-spike:${address}`;
  return {
    native: receiptSchema.nullable().parse((await dbGet('journal', `native:${address}`)) ?? null),
    small: stepSchema.nullable().parse((await dbGet('journal', `${key}:small`)) ?? null),
    large: stepSchema.nullable().parse((await dbGet('journal', `${key}:large`)) ?? null),
  };
}
export async function windowSpike(backup: unknown, password: string, expectedAddress: string) {
  const payload = await decryptVault(backup, password);
  const account = await deriveUnifiedAccount(payload.mnemonic, 0);
  if (account.cosmos !== expectedAddress) throw new Error('DEMO_BUSINESS_REQUIRED');
  const runtime = await BusinessRuntime.open(account, () => undefined);
  const record = async () => receiptSchema.parse(await dbGet('journal', `native:${account.cosmos}`));
  const state = async () => {
    const block = (await client.getBlockNumber({ cacheTime: 0 })).toString();
    const window = await checkWindow(browserChain, account.cosmos);
    return {
      block,
      kind: window.kind,
      remainingTxs: window.kind === 'OPEN' ? String(window.window.remainingTxs) : '0',
      remainingValue: window.kind === 'OPEN' ? String(window.window.remainingValue) : '0',
      remainingBlocks: window.kind === 'OPEN' ? String(window.window.remainingBlocks) : '0',
    };
  };
  const key = `m10b-window-spike:${account.cosmos}`;
  const prior = await dbGet('journal', key);
  if (prior !== undefined) return prior;
  const smallPlan = { maxTxs: 1n, maxValue: 10000n };
  const largePlan = { maxTxs: 3n, maxValue: 1000000n };
  const savedSmall = await dbGet('journal', `${key}:small`);
  if (savedSmall === undefined) {
    await nativeAction(account, true, 'm10b-window-small', 'hybrid', [
      openEvmWindowMsg({ sender: account.cosmos, blocks: 600n, ...smallPlan }),
    ]);
    await dbPut('journal', `${key}:small`, { receipt: await record(), state: await state() });
  }
  const small = stepSchema.parse(await dbGet('journal', `${key}:small`));
  const savedLarge = await dbGet('journal', `${key}:large`);
  if (savedLarge === undefined) {
    const before = await state();
    if (before.kind !== 'OPEN' || before.remainingValue !== '10000' || before.remainingTxs !== '1')
      throw new Error('SMALL_WINDOW_NOT_STILL_OPEN');
    try {
      await nativeAction(account, true, 'm10b-window-large', 'hybrid', [
        openEvmWindowMsg({ sender: account.cosmos, blocks: 600n, ...largePlan }),
      ]);
    } catch (error: unknown) {
      if (!(error instanceof NativeBroadcastError)) throw error;
      const result = {
        address: account.cosmos,
        small,
        before,
        outcome: 'REJECTED',
        rejection: error.fields(),
        after: await state(),
      };
      await dbPut('journal', key, result);
      return result;
    }
    await dbPut('journal', `${key}:large`, { receipt: await record(), state: await state() });
  }
  const large = stepSchema.parse(await dbGet('journal', `${key}:large`));
  if (large.state.remainingTxs !== '3' || large.state.remainingValue !== '1000000')
    throw new Error('LARGER_WINDOW_NOT_REPLACED');
  const next = runtime.journal.read().operations.find((operation) => operation.id === 'm10b-window-next-evm');
  if (next?.stage === 'BROADCAST' || next?.stage === 'OUTCOME_UNKNOWN') await runtime.resolve();
  const gateway = runtime.journal.protectGateway(
    createGateway(browserChain, account, client, [], account.evm as `0x${string}`),
    () => runtime.save(),
  );
  const evm = await executeOperation(
    runtime.journal,
    {
      id: 'm10b-window-next-evm',
      input: null,
      requestKey: 'm10b-self-transfer-002-qor',
      build: () =>
        Promise.resolve({
          data: '0x00',
          valueWei: '20000000000000000',
          outputs: [],
          root: null,
          nullifier: null,
          feeWei: '0',
        }),
    },
    gateway,
  );
  const result = {
    address: account.cosmos,
    small,
    smallPlan,
    large,
    largePlan,
    outcome: 'REPLACED',
    evm,
    after: await state(),
  };
  if (evm.kind === 'LANDED') await dbPut('journal', key, result);
  return result;
}
