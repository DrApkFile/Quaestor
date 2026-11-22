import { sha3_256 } from '@noble/hashes/sha3.js';
import { z } from 'zod';
import { dbGet, dbPut } from './db.js';
const envelope = z.object({ nonce: z.string(), ciphertext: z.string() }).strict();
const encode = (bytes: Uint8Array) => btoa(Array.from(bytes, (value) => String.fromCharCode(value)).join(''));
const decode = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
export interface PrivateStorage {
  get(key: string): Promise<unknown>;
  put(key: string, data: unknown): Promise<void>;
}
export async function privateStorage(address: string, secret: Uint8Array): Promise<PrivateStorage> {
  const domain = new TextEncoder().encode('quaestor:private-store:v1');
  const material = new Uint8Array(domain.length + secret.length);
  material.set(domain);
  material.set(secret, domain.length);
  const raw = sha3_256(material);
  material.fill(0);
  const key = await crypto.subtle.importKey('raw', Uint8Array.from(raw), 'AES-GCM', false, ['encrypt', 'decrypt']);
  raw.fill(0);
  return {
    async get(name) {
      const saved = await dbGet('journal', `${address}:${name}`);
      if (saved === undefined) return undefined;
      const parsed = envelope.parse(saved);
      const bytes = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: Uint8Array.from(decode(parsed.nonce)),
          additionalData: new TextEncoder().encode(`${address}:${name}`),
        },
        key,
        Uint8Array.from(decode(parsed.ciphertext)),
      );
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    },
    async put(name, value) {
      const nonce = crypto.getRandomValues(new Uint8Array(12));
      const data = new TextEncoder().encode(JSON.stringify(value));
      const bytes = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce, additionalData: new TextEncoder().encode(`${address}:${name}`) },
        key,
        data,
      );
      data.fill(0);
      await dbPut('journal', `${address}:${name}`, { nonce: encode(nonce), ciphertext: encode(new Uint8Array(bytes)) });
    },
  };
}
