import protobuf from 'protobufjs';
import { erc20Abi, type PublicClient } from 'viem';
import { qorechainRegistry, type UnifiedAccount } from '@qorechain/sdk';
import { z } from 'zod';
import { uintSchema, type ChainConfig } from '../src/config.js';
import type { RoundtripEvidence } from '../src/evidence.js';
import { broadcastNative } from '../src/native.js';

const balanceSchema = z.object({ balance: z.object({ denom: z.string(), amount: uintSchema }).strict() }).strict();
const typeUrl = '/cosmos.evm.erc20.v1.MsgConvertCoin';
function conversionRegistry() {
  const root = new protobuf.Root();
  const coin = new protobuf.Type('Coin')
    .add(new protobuf.Field('denom', 1, 'string')).add(new protobuf.Field('amount', 2, 'string'));
  const message = new protobuf.Type('MsgConvertCoin').add(new protobuf.Field('coin', 1, 'Coin'))
    .add(new protobuf.Field('receiver', 2, 'string')).add(new protobuf.Field('sender', 3, 'string'));
  root.add(coin).add(message).resolveAll();
  const registry = qorechainRegistry();
  registry.register(typeUrl, message);
  return registry;
}
export async function runFusdSpike(config: ChainConfig, account: UnifiedAccount, reader: PublicClient,
  evidence: RoundtripEvidence, save: () => void): Promise<NonNullable<RoundtripEvidence['fusd']>> {
  if (evidence.fusd) return evidence.fusd;
  const result: NonNullable<RoundtripEvidence['fusd']> = {
    status: 'FAILED', before: null, after: null, bankBefore: null, bankAfter: null,
    errorCode: null, at: new Date().toISOString(),
  };
  const denom = `erc20:${config.fusd}`;
  const readBank = async () => {
    const response = await fetch(`${config.rest}/cosmos/bank/v1beta1/balances/${account.cosmos}/by_denom?denom=${encodeURIComponent(denom)}`);
    if (!response.ok) throw new Error('BANK_READ_FAILED');
    const body: unknown = await response.json();
    return balanceSchema.parse(body).balance.amount;
  };
  const readToken = async () => {
    const blockNumber = await reader.getBlockNumber({ cacheTime: 0 });
    return (await reader.readContract({ address: config.fusd, abi: erc20Abi, functionName: 'balanceOf',
      args: [account.evm as `0x${string}`], blockNumber })).toString();
  };
  try {
    result.before = await readToken();
    result.bankBefore = await readBank();
    const transaction = await broadcastNative(config, account, 'hybrid', [{ typeUrl,
      value: { coin: { denom, amount: '100000000' }, receiver: account.evm, sender: account.cosmos },
    }], conversionRegistry());
    evidence.nativeTransactions.push({ action: 'convert-fusd', ...transaction, feeUqor: '100000' });
    save();
    result.after = await readToken();
    result.bankAfter = await readBank();
    result.status = BigInt(result.after) - BigInt(result.before) === 100_000_000n ? 'CONVERTED' : 'FAILED';
    if (result.status === 'FAILED') result.errorCode = 'CONVERSION_BALANCE_MISMATCH';
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    result.errorCode = /^[A-Z_]+$/.test(message) ? message : 'CONVERSION_FAILED';
    try { result.after = await readToken(); result.bankAfter = await readBank(); }
    catch { result.errorCode = 'CONVERSION_AND_FINAL_READ_FAILED'; }
  }
  return result;
}
