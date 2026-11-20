import { StargateClient } from '@cosmjs/stargate';
import { EthNativeSigner, type UnifiedAccount } from '@qorechain/sdk';
import { z } from 'zod';
import type { Registry } from '@cosmjs/proto-signing';
import { uintSchema, type ChainConfig } from './config.js';

const sequenceSchema = z.object({ account_number: uintSchema, sequence: uintSchema }).passthrough();
const accountSchema = z.object({ account: z.union([
  z.object({ base_account: sequenceSchema }).passthrough(), sequenceSchema,
]) }).passthrough();
export async function broadcastNative(config: ChainConfig, account: UnifiedAccount,
  mode: 'hybrid' | 'classical', messages: Parameters<EthNativeSigner['sign']>[0]['messages'], registry?: Registry) {
  const response = await fetch(`${config.rest}/cosmos/auth/v1beta1/accounts/${account.cosmos}`);
  if (!response.ok) throw new Error('NETWORK_UNAVAILABLE');
  const body: unknown = await response.json();
  const parsed = accountSchema.safeParse(body);
  if (!parsed.success) throw new Error('ACCOUNT_RESPONSE_INVALID');
  const value = parsed.data.account;
  const sequence = 'base_account' in value ? sequenceSchema.parse(value.base_account) : sequenceSchema.parse(value);
  const signer = new EthNativeSigner(account, { signMode: mode, rest: config.rest, ...(registry ? { registry } : {}) });
  const transport = await StargateClient.connect(config.consensusRpc);
  try {
    const result = await signer.signAndBroadcast(transport, {
      chainId: config.nativeChainId, accountNumber: BigInt(sequence.account_number), sequence: BigInt(sequence.sequence),
      fee: { amount: [{ denom: 'uqor', amount: '100000' }], gas: '800000' }, messages,
    });
    if (result.code !== 0 || result.gasUsed === undefined || result.height === undefined) throw new Error('NATIVE_TRANSACTION_FAILED');
    return { hash: result.transactionHash, height: result.height, gasUsed: result.gasUsed.toString() };
  } finally {
    transport.disconnect();
  }
}
