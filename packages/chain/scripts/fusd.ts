import protobuf from 'protobufjs';
import { erc20Abi, type PublicClient } from 'viem';
import { qorechainRegistry, type UnifiedAccount } from '@qorechain/sdk';
import { z } from 'zod';
import { uintSchema, type ChainConfig } from '../src/config.js';
import type { RoundtripEvidence } from '../src/evidence.js';
import { NativeBroadcastError } from '../src/nativeError.js';
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
export async function runFusdConversion(config: ChainConfig, account: UnifiedAccount, reader: PublicClient, onTransaction: (transaction: Awaited<ReturnType<typeof broadcastNative>>) => void): Promise<NonNullable<RoundtripEvidence['fusd']>> {
    const result: NonNullable<RoundtripEvidence['fusd']> = {
        status: 'FAILED', before: null, after: null, bankBefore: null, bankAfter: null,
        errorCode: null, code: null, codespace: null, rawLog: null, transactionHash: null, at: new Date().toISOString(),
    };
    const denom = `erc20:${config.fusd}`;
    let snapshotBlock: bigint | null = null;
    const readBank = async () => {
        if (snapshotBlock === null)
            throw new Error('SNAPSHOT_BLOCK_REQUIRED');
        const response = await fetch(`${config.rest}/cosmos/bank/v1beta1/balances/${account.cosmos}/by_denom?denom=${encodeURIComponent(denom)}`, { headers: { 'x-cosmos-block-height': snapshotBlock.toString() } });
        if (!response.ok)
            throw new Error('BANK_READ_FAILED');
        const body: unknown = await response.json();
        const balance = balanceSchema.parse(body).balance;
        if (balance.denom !== denom)
            throw new Error('BANK_DENOM_MISMATCH');
        return balance.amount;
    };
    const readToken = async () => {
        const blockNumber = await reader.getBlockNumber({ cacheTime: 0 });
        snapshotBlock = blockNumber;
        return (await reader.readContract({ address: config.fusd, abi: erc20Abi, functionName: 'balanceOf',
            args: [account.evm as `0x${string}`], blockNumber })).toString();
    };
    try {
        result.before = await readToken();
        result.bankBefore = await readBank();
        const transaction = await broadcastNative(config, account, 'hybrid', [{ typeUrl,
                value: { coin: { denom, amount: '100000000' }, receiver: account.evm, sender: account.cosmos },
            }], conversionRegistry());
        result.transactionHash = transaction.hash;
        onTransaction(transaction);
        result.after = await readToken();
        result.bankAfter = await readBank();
        result.status = BigInt(result.after) - BigInt(result.before) === 100000000n ? 'CONVERTED' : 'FAILED';
        if (result.status === 'FAILED')
            result.errorCode = 'CONVERSION_BALANCE_MISMATCH';
    }
    catch (error: unknown) {
        if (error instanceof NativeBroadcastError) {
            result.code = error.code;
            result.codespace = error.codespace;
            result.rawLog = error.rawLog;
            result.transactionHash = error.hash;
            result.errorCode = error.kind;
        }
        else {
            result.errorCode = 'FUSD_SPIKE_FAILED';
        }
        try {
            result.after = await readToken();
            result.bankAfter = await readBank();
        }
        catch {
            result.errorCode = 'CONVERSION_AND_FINAL_READ_FAILED';
        }
    }
    return result;
}
export function runFusdSpike(config: ChainConfig, account: UnifiedAccount, reader: PublicClient, evidence: RoundtripEvidence, save: () => void): Promise<NonNullable<RoundtripEvidence['fusd']>> {
    return Promise.resolve().then(() => {
        if (evidence.fusd)
            return evidence.fusd;
        return runFusdConversion(config, account, reader, transaction => {
            evidence.nativeTransactions.push({ action: 'convert-fusd', ...transaction, feeUqor: '100000' });
            save();
        });
    });
}
