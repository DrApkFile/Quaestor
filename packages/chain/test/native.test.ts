import { readFileSync } from 'node:fs';
import type { UnifiedAccount } from '@qorechain/sdk';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { broadcastNative } from '../src/native.js';
import { NativeBroadcastError } from '../src/nativeError.js';
import { parseConfig } from '../src/config.js';
const mock = vi.hoisted(() => ({ send: vi.fn(), disconnect: vi.fn() }));
vi.mock('@qorechain/sdk', () => ({ EthNativeSigner: class {
        signAndBroadcast = mock.send;
    } }));
vi.mock('@cosmjs/stargate', () => ({ StargateClient: { connect: () => Promise.resolve().then(() => ({ disconnect: mock.disconnect })) } }));
const config = parseConfig(JSON.parse(readFileSync(new URL('../../../config/diana.json', import.meta.url), 'utf8')) as unknown);
const account = { privateKey: `0x${'12'.repeat(32)}`, mnemonic: 'synthetic mnemonic for redaction testing',
    cosmos: 'qor1test', pqc: { secretKey: Uint8Array.of(1, 2, 3), publicKey: Uint8Array.of(4, 5, 6) } } as unknown as UnifiedAccount;
beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', () => Promise.resolve().then(() => ({ ok: true, json: () => Promise.resolve().then(() => ({ account: { account_number: '1', sequence: '2' } })) })));
});
afterEach(() => vi.unstubAllGlobals());
it('T-NATIVE preserves a rejected chain code, codespace and a redacted log truncated to 500 characters', async () => {
    const rawLog = `${account.privateKey} ${String(account.mnemonic)} ${'insufficient funds '.repeat(100)}`;
    mock.send.mockRejectedValue(Object.assign(new Error('unsafe underlying details'), { code: 5, codespace: 'sdk', rawLog, txHash: account.privateKey.slice(2) }));
    const error: unknown = await broadcastNative(config, account, 'hybrid', []).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(NativeBroadcastError);
    if (!(error instanceof NativeBroadcastError))
        throw new Error('ERROR_TYPE_REQUIRED');
    expect(error.code).toBe(5);
    expect(error.hash).toBeNull();
    expect(error.codespace).toBe('sdk');
    expect(error.rawLog).toHaveLength(500);
    expect(error.rawLog).toContain('insufficient funds');
    expect(JSON.stringify(error)).not.toContain(account.privateKey);
    expect(JSON.stringify(error)).not.toContain(account.mnemonic);
    expect(error.message).toBe('NATIVE_CHAIN_REJECTED');
    expect(mock.disconnect).toHaveBeenCalledOnce();
});
it('T-NATIVE retains CheckTx log fields and does not keep the original unsafe error', async () => {
    mock.send.mockRejectedValue({ code: 7, codespace: 'pqc', log: 'window rejected' });
    await expect(broadcastNative(config, account, 'hybrid', [])).rejects.toMatchObject({
        code: 7, codespace: 'pqc', rawLog: 'window rejected',
    });
});
it('T-NATIVE rejects nonzero returned receipts with their original chain details', async () => {
    mock.send.mockResolvedValue({ code: 12, codespace: 'erc20', rawLog: 'conversion disabled', transactionHash: 'ab'.repeat(32) });
    await expect(broadcastNative(config, account, 'hybrid', [])).rejects.toMatchObject({
        code: 12, codespace: 'erc20', rawLog: 'conversion disabled', hash: 'ab'.repeat(32),
    });
});
it('T-NATIVE represents transport uncertainty without inventing a chain code or leaking its message', async () => {
    mock.send.mockRejectedValue(new Error(account.privateKey));
    await expect(broadcastNative(config, account, 'hybrid', [])).rejects.toMatchObject({
        kind: 'NATIVE_BROADCAST_FAILED', code: null, codespace: null, rawLog: null,
    });
});
