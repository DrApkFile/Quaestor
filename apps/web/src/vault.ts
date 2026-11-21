import { scryptAsync } from '@noble/hashes/scrypt.js';
import { z } from 'zod';
const encoded = z
  .string()
  .regex(/^[A-Za-z0-9+/]+={0,2}$/)
  .max(20000);
export const vaultSchema = z
  .object({
    v: z.literal(1),
    network: z.literal('qorechain-diana'),
    kdf: z.literal('scrypt'),
    N: z.literal(131072),
    r: z.literal(8),
    p: z.literal(1),
    salt: encoded,
    nonce: encoded,
    ciphertext: encoded,
  })
  .strict();
export type VaultEnvelope = z.infer<typeof vaultSchema>;
const payloadSchema = z.object({ mnemonic: z.string().min(12).max(512), index: z.literal(0) }).strict();
const aad = new TextEncoder().encode('quaestor:vault:1:qorechain-diana');
const encode = (bytes: Uint8Array) => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
const decode = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
async function aesKey(passphrase: string, salt: Uint8Array) {
  const password = new TextEncoder().encode(passphrase);
  const raw = await scryptAsync(password, salt, { N: 131072, r: 8, p: 1, dkLen: 32, maxmem: 256 * 1024 * 1024 });
  try {
    return await crypto.subtle.importKey('raw', Uint8Array.from(raw), { name: 'AES-GCM' }, false, [
      'encrypt',
      'decrypt',
    ]);
  } finally {
    raw.fill(0);
    password.fill(0);
  }
}
export async function encryptVault(mnemonic: string, passphrase: string): Promise<VaultEnvelope> {
  if (passphrase.length < 12) throw new Error('PASSPHRASE_TOO_SHORT');
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const key = await aesKey(passphrase, salt);
  const data = new TextEncoder().encode(JSON.stringify(payloadSchema.parse({ mnemonic, index: 0 })));
  try {
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad }, key, data);
    return vaultSchema.parse({
      v: 1,
      network: 'qorechain-diana',
      kdf: 'scrypt',
      N: 131072,
      r: 8,
      p: 1,
      salt: encode(salt),
      nonce: encode(nonce),
      ciphertext: encode(new Uint8Array(ciphertext)),
    });
  } finally {
    data.fill(0);
  }
}
export async function decryptVault(input: unknown, passphrase: string) {
  try {
    const envelope = vaultSchema.parse(input);
    const salt = decode(envelope.salt);
    const nonce = decode(envelope.nonce);
    const ciphertext = decode(envelope.ciphertext);
    if (salt.length !== 32 || nonce.length !== 12 || ciphertext.length < 16) throw new Error('INVALID_BACKUP');
    const key = await aesKey(passphrase, salt);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad }, key, ciphertext);
    const bytes = new Uint8Array(plaintext);
    try {
      return payloadSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown);
    } finally {
      bytes.fill(0);
    }
  } catch {
    throw new Error('INVALID_PASSPHRASE_OR_BACKUP');
  }
}
