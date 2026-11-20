import { buildRegisterKemKeyMessage, describeKemRegistryError, type SealKeyPair } from '@qorechain/qoreseal';
import { fetchKemKey, fetchMlkemPublicKey } from '@qorechain/qoreseal/network';
import { fetchPqKeyStatus } from '@qorechain/qoresign/network';
import { qorechainTypes, type UnifiedAccount } from '@qorechain/sdk';
import type { ChainConfig } from '../config.js';
import { broadcastNative } from '../native.js';
import { NativeBroadcastError } from '../nativeError.js';
export function registryFetch(config: ChainConfig, block: bigint) {
    return async (url: string, init?: RequestInit) => {
        if (!url.startsWith(`${config.rest}/qorechain/pqc/v1/`))
            throw new Error('REGISTRY_URL_INVALID');
        const headers = new Headers(init?.headers);
        headers.set('x-cosmos-block-height', block.toString());
        const response = await fetch(url, { ...init, headers });
        const height = response.headers.get('x-cosmos-block-height');
        if (height !== null && height !== block.toString())
            throw new Error('REGISTRY_HEIGHT_MISMATCH');
        return response;
    };
}
export interface RegistrySnapshot {
    address: string;
    block: bigint;
    mlkemPublicKey: Uint8Array;
    pqPublicKey: Uint8Array;
    possessionProven: boolean;
}
export async function readRegistry(config: ChainConfig, address: string, block: bigint): Promise<RegistrySnapshot> {
    const options = { rest: config.rest, address, fetch: registryFetch(config, block) };
    const [mlkemPublicKey, pq] = await Promise.all([fetchMlkemPublicKey(options), fetchPqKeyStatus(options)]);
    if (!pq.registered || pq.algorithmId !== 1 || pq.possessionProven !== true || !pq.publicKey) {
        throw new Error('PQ_POSSESSION_NOT_PROVEN');
    }
    return { address, block, mlkemPublicKey, pqPublicKey: pq.publicKey, possessionProven: true as const };
}
export async function registerKemKey(config: ChainConfig, account: UnifiedAccount, keys: SealKeyPair, block: bigint, onTransaction?: (transaction: Awaited<ReturnType<typeof broadcastNative>>) => void) {
    const existing = await fetchKemKey({ rest: config.rest, address: account.cosmos, fetch: registryFetch(config, block) });
    if (existing.registered) {
        const same = existing.algorithmId === 2 && existing.publicKey !== undefined &&
            Buffer.from(existing.publicKey).equals(Buffer.from(keys.mlkemPublicKey));
        return same ? { kind: 'ALREADY_REGISTERED' } as const : { kind: 'KEM_KEY_MISMATCH' } as const;
    }
    const encoded = buildRegisterKemKeyMessage({ sender: account.cosmos, mlkemPublicKey: keys.mlkemPublicKey });
    const message = { typeUrl: encoded.typeUrl, value: qorechainTypes.pqc.MsgRegisterKEMKey.decode(encoded.value) };
    try {
        const transaction = await broadcastNative(config, account, 'hybrid', [message]);
        onTransaction?.(transaction);
        const confirmed = await fetchMlkemPublicKey({ rest: config.rest, address: account.cosmos,
            fetch: registryFetch(config, BigInt(transaction.height)) });
        if (!Buffer.from(confirmed).equals(Buffer.from(keys.mlkemPublicKey)))
            return { kind: 'KEM_KEY_MISMATCH' } as const;
        return { kind: 'REGISTERED', transaction } as const;
    }
    catch (error: unknown) {
        if (!(error instanceof NativeBroadcastError))
            throw error;
        const reason = error.code !== null && error.codespace !== null ? describeKemRegistryError(error.codespace, error.code) : undefined;
        return { kind: 'KEM_REGISTRATION_FAILED', failure: error.fields(), registryReason: reason ?? null } as const;
    }
}
