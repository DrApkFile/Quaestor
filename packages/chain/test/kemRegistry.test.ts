import { readFileSync } from 'node:fs';
import { addressFromBytes } from '@qorechain/qoresign';
import { generateSealKeys, KEM_REGISTRY_ERRORS } from '@qorechain/qoreseal';
import { fetchKemKey, fetchMlkemPublicKey } from '@qorechain/qoreseal/network';
import type { UnifiedAccount } from '@qorechain/sdk';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { registerKemKey, registryFetch } from '../src/tickets/kemRegistry.js';
import { broadcastNative } from '../src/native.js';
import { NativeBroadcastError } from '../src/nativeError.js';
import { parseConfig } from '../src/config.js';
vi.mock('@qorechain/qoreseal/network', () => ({ fetchKemKey: vi.fn(), fetchMlkemPublicKey: vi.fn() }));
vi.mock('../src/native.js', () => ({ broadcastNative: vi.fn() }));
const config = parseConfig(
  JSON.parse(readFileSync(new URL('../../../config/diana.json', import.meta.url), 'utf8')) as unknown,
);
const keys = generateSealKeys();
const account = { cosmos: addressFromBytes(new Uint8Array(20).fill(1)).bech32 } as unknown as UnifiedAccount;
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());
it('T-REG leaves an identical registered key unchanged without sending a transaction', async () => {
  vi.mocked(fetchKemKey).mockResolvedValue({ registered: true, algorithmId: 2, publicKey: keys.mlkemPublicKey });
  expect(await registerKemKey(config, account, keys, 42n)).toEqual({ kind: 'ALREADY_REGISTERED' });
  expect(broadcastNative).not.toHaveBeenCalled();
});
it('T-REG refuses to overwrite a different KEM key', async () => {
  vi.mocked(fetchKemKey).mockResolvedValue({
    registered: true,
    algorithmId: 2,
    publicKey: generateSealKeys().mlkemPublicKey,
  });
  expect(await registerKemKey(config, account, keys, 42n)).toEqual({ kind: 'KEM_KEY_MISMATCH' });
  expect(broadcastNative).not.toHaveBeenCalled();
});
it('T-REG decodes the library message for the SDK registry and records its observed transaction before confirmation', async () => {
  vi.mocked(fetchKemKey).mockResolvedValue({ registered: false });
  vi.mocked(fetchMlkemPublicKey).mockResolvedValue(keys.mlkemPublicKey);
  const transaction = { hash: 'ab'.repeat(32), height: 43, gasUsed: '1' };
  vi.mocked(broadcastNative).mockResolvedValue(transaction);
  const recorded = vi.fn();
  expect(await registerKemKey(config, account, keys, 42n, recorded)).toEqual({ kind: 'REGISTERED', transaction });
  expect(broadcastNative).toHaveBeenCalledWith(config, account, 'hybrid', [
    {
      typeUrl: '/qorechain.pqc.v1.MsgRegisterKEMKey',
      value: expect.objectContaining({
        sender: account.cosmos,
        algorithmId: 2,
        publicKey: keys.mlkemPublicKey,
      }) as unknown,
    },
  ]);
  expect(recorded).toHaveBeenCalledWith(transaction);
});
it('T-REG retains chain diagnostics and describes a KEM registry rejection', async () => {
  vi.mocked(fetchKemKey).mockResolvedValue({ registered: false });
  const code = Number(Object.keys(KEM_REGISTRY_ERRORS)[0]);
  vi.mocked(broadcastNative).mockRejectedValue(
    new NativeBroadcastError({ code, codespace: 'pqc', rawLog: 'registry refused' }, []),
  );
  expect(await registerKemKey(config, account, keys, 42n)).toMatchObject({
    kind: 'KEM_REGISTRATION_FAILED',
    failure: { code, codespace: 'pqc', rawLog: 'registry refused' },
    registryReason: KEM_REGISTRY_ERRORS[code],
  });
});
it('T-REG pins REST reads and refuses a response from a different height', async () => {
  const fetch = vi.fn((_url: string, init?: RequestInit) => {
    return Promise.resolve().then(() => {
      expect(new Headers(init?.headers).get('x-cosmos-block-height')).toBe('42');
      return new Response('{}', { status: 200, headers: { 'x-cosmos-block-height': '43' } });
    });
  });
  vi.stubGlobal('fetch', fetch);
  await expect(registryFetch(config, 42n)(`${config.rest}/qorechain/pqc/v1/kem/qor1test`)).rejects.toThrow(
    'REGISTRY_HEIGHT_MISMATCH',
  );
});
