import { readFileSync, writeFileSync } from 'node:fs';
import { hashBytes } from '../packages/core/src/codec.js';
import { z } from 'zod';
import { loadAccount } from '../packages/chain/src/accounts.js';
import { accountSealKeys } from '../packages/chain/src/tickets/sealKeys.js';
const root = new URL('../', import.meta.url);
export async function imageScanSecrets() {
  const secrets = new Set<string>();
  const collect = (value: unknown, name = '') => {
    if (
      typeof value === 'string' &&
      /^(mnemonic|privateKey|secretKey|secret|key|epochKey|password)$/.test(name) &&
      value.length > 20
    )
      secrets.add(value);
    if (Array.isArray(value)) for (const item of value as unknown[]) collect(item);
    else if (typeof value === 'object' && value !== null)
      for (const [key, item] of Object.entries(value)) collect(item, key);
  };
  const storage = z
    .object({
      origins: z.array(
        z
          .object({
            indexedDB: z
              .array(
                z
                  .object({
                    stores: z.array(
                      z
                        .object({
                          records: z.array(z.object({ key: z.unknown(), value: z.unknown() }).passthrough()),
                        })
                        .passthrough(),
                    ),
                  })
                  .passthrough(),
              )
              .optional(),
          })
          .passthrough(),
      ),
    })
    .passthrough();
  const contexts = ['client', 'business', 'other'].map((name) =>
    storage.parse(
      JSON.parse(readFileSync(new URL(`.accounts/m7b-browser/${name}-state.json`, root), 'utf8')) as unknown,
    ),
  );
  for (const role of ['client', 'business', 'supplier1', 'supplier2', 'auditor'] as const) {
    const account = await loadAccount(new URL('.accounts', root).pathname, role);
    const keys = accountSealKeys(account);
    collect(account);
    for (const bytes of [account.pqc.secretKey, keys.seed, keys.mlkemSecretKey, keys.x25519SecretKey]) {
      secrets.add(Buffer.from(bytes).toString('hex'));
      secrets.add(Buffer.from(bytes).toString('base64'));
    }
    const material = Buffer.concat([Buffer.from('quaestor:private-store:v1'), account.pqc.secretKey]);
    const key = await crypto.subtle.importKey(
      'raw',
      Uint8Array.from(Buffer.from(hashBytes(material).slice(2), 'hex')),
      'AES-GCM',
      false,
      ['decrypt'],
    );
    for (const state of contexts)
      for (const origin of state.origins)
        for (const db of origin.indexedDB ?? [])
          for (const store of db.stores)
            for (const record of store.records) {
              if (typeof record.key !== 'string' || !record.key.startsWith(`${account.cosmos}:`)) continue;
              const envelope = z.object({ nonce: z.string(), ciphertext: z.string() }).safeParse(record.value);
              if (!envelope.success) continue;
              const bytes = await crypto.subtle.decrypt(
                {
                  name: 'AES-GCM',
                  iv: Buffer.from(envelope.data.nonce, 'base64'),
                  additionalData: Buffer.from(record.key),
                },
                key,
                Buffer.from(envelope.data.ciphertext, 'base64'),
              );
              collect(JSON.parse(Buffer.from(bytes).toString('utf8')) as unknown);
            }
  }
  const fixture = z
    .object({ password: z.string(), canaries: z.array(z.string()) })
    .passthrough()
    .parse(JSON.parse(readFileSync(new URL('.accounts/m7b-browser/fixtures.json', root), 'utf8')) as unknown);
  secrets.add(fixture.password);
  for (const canary of fixture.canaries) secrets.add(canary);
  for (const value of [...secrets]) {
    secrets.add(Buffer.from(value).toString('hex'));
    secrets.add(Buffer.from(value).toString('base64'));
    if (/^0x[\da-f]{64}$/i.test(value)) {
      secrets.add(value.slice(2));
      secrets.add(BigInt(value).toString());
    }
  }
  writeFileSync(new URL('.accounts/m7b-browser/scan-secrets.json', root), JSON.stringify([...secrets]), {
    mode: 0o600,
  });
}
