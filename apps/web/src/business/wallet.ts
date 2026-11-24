import { erc20Abi, encodeFunctionData, zeroAddress, type Hex } from 'viem';
import { z } from 'zod';
import { qorechainRegistry } from '@qorechain/sdk';
import protobuf from 'protobufjs';
import { nativeAction } from '../nativeClient.js';
import { BusinessRuntime, browserChain, client } from './runtime.js';
import { requireWindow } from './windows.js';
import { fusd } from './schema.js';
export const fusdDenom = `erc20:${fusd}`;
export async function balances(runtime: BusinessRuntime) {
  const block = await client.getBlockNumber({ cacheTime: 0 });
  const response = await fetch(`${browserChain.rest}/cosmos/bank/v1beta1/balances/${runtime.account.cosmos}`, {
    headers: { 'x-cosmos-block-height': block.toString() },
  });
  if (!response.ok) throw new Error('NETWORK_UNAVAILABLE');
  const bank = z
    .object({ balances: z.array(z.object({ denom: z.string(), amount: z.string().regex(/^\d+$/) }).strict()) })
    .passthrough()
    .parse(await response.json());
  const [native, token] = await Promise.all([
    client.getBalance({ address: runtime.account.evm as Hex, blockNumber: block }),
    client.readContract({
      address: fusd,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [runtime.account.evm as Hex],
      blockNumber: block,
    }),
  ]);
  return { block: block.toString(), native: native.toString(), token: token.toString(), bank: bank.balances };
}
export async function convert(runtime: BusinessRuntime, amount: bigint) {
  const root = new protobuf.Root();
  const coin = new protobuf.Type('Coin')
    .add(new protobuf.Field('denom', 1, 'string'))
    .add(new protobuf.Field('amount', 2, 'string'));
  const message = new protobuf.Type('MsgConvertCoin')
    .add(new protobuf.Field('coin', 1, 'Coin'))
    .add(new protobuf.Field('receiver', 2, 'string'))
    .add(new protobuf.Field('sender', 3, 'string'));
  root.add(coin).add(message).resolveAll();
  const registry = qorechainRegistry();
  const typeUrl = '/cosmos.evm.erc20.v1.MsgConvertCoin';
  registry.register(typeUrl, message);
  if (amount <= 0n) throw new Error('INVALID_AMOUNT');
  await nativeAction(
    runtime.account,
    true,
    `convert-${crypto.randomUUID()}`,
    'hybrid',
    [
      {
        typeUrl,
        value: {
          coin: { denom: fusdDenom, amount: amount.toString() },
          receiver: runtime.account.evm,
          sender: runtime.account.cosmos,
        },
      },
    ],
    registry,
  );
}
export async function deposit(runtime: BusinessRuntime, asset: Hex, amount: bigint, id: string) {
  if (amount <= 0n) throw new Error('INVALID_AMOUNT');
  requireWindow(runtime, asset === zeroAddress ? 1 : 2, asset === zeroAddress ? amount : 0n);
  if (asset !== zeroAddress)
    await runtime.call(
      `${id}-approve`,
      asset,
      encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [browserChain.pool, amount] }),
    );
  await runtime.requireResult(id, await (await runtime.pool()).shield(id, asset, amount));
}
export async function cashOut(runtime: BusinessRuntime, commitment: Hex, id: string) {
  requireWindow(runtime, 1);
  await runtime.requireResult(id, await (await runtime.pool()).unshield(id, commitment, runtime.account.evm as Hex));
}
