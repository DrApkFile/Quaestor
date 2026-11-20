import { readFileSync } from 'node:fs';
import type { PublicClient } from 'viem';
import type { UnifiedAccount } from '@qorechain/sdk';
import { afterEach, expect, it, vi } from 'vitest';
import { runFusdConversion } from '../scripts/fusd.js';
import { broadcastNative } from '../src/native.js';
import { NativeBroadcastError } from '../src/nativeError.js';
import { parseConfig } from '../src/config.js';
vi.mock('../src/native.js', () => ({ broadcastNative: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());
it('T-FUSD records the actual native rejection fields with a funded bank balance', async () => {
    const config = parseConfig(JSON.parse(readFileSync(new URL('../../../config/diana.json', import.meta.url), 'utf8')) as unknown);
    vi.stubGlobal('fetch', () => Promise.resolve().then(() => ({ ok: true, json: () => Promise.resolve().then(() => ({ balance: { denom: `erc20:${config.fusd}`, amount: '100000000' } })) })));
    vi.mocked(broadcastNative).mockRejectedValue(new NativeBroadcastError({ code: 9, codespace: 'erc20', rawLog: 'conversion is disabled' }, []));
    const account = { cosmos: 'qor1test', evm: config.pool } as unknown as UnifiedAccount;
    const reader = { getBlockNumber: () => Promise.resolve().then(() => 100n), readContract: () => Promise.resolve().then(() => 0n) } as unknown as PublicClient;
    const result = await runFusdConversion(config, account, reader, vi.fn());
    expect(result).toMatchObject({ status: 'FAILED', bankBefore: '100000000', bankAfter: '100000000',
        errorCode: 'NATIVE_CHAIN_REJECTED', code: 9, codespace: 'erc20', rawLog: 'conversion is disabled' });
    expect(broadcastNative).toHaveBeenCalledOnce();
});
