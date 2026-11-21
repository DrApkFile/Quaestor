import { z } from 'zod';
import { vaultSchema, type VaultEnvelope } from './vault.js';
const savedSchema = z.object({ envelope: vaultSchema, backupDownloaded: z.boolean() }).strict();
export async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('quaestor-testnet-v1', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('vault');
      request.result.createObjectStore('journal');
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(new Error('VAULT_STORAGE_FAILED'));
    };
  });
}
export async function dbGet(store: 'vault' | 'journal', key: string): Promise<unknown> {
  const db = await database();
  try {
    return await new Promise<unknown>((resolve, reject) => {
      const request = db.transaction(store, 'readonly').objectStore(store).get(key);
      request.onsuccess = () => {
        const result: unknown = request.result;
        resolve(result);
      };
      request.onerror = () => {
        reject(new Error('VAULT_STORAGE_FAILED'));
      };
    });
  } finally {
    db.close();
  }
}
export async function dbPut(store: 'vault' | 'journal', key: string, value: unknown) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite');
      transaction.objectStore(store).put(value, key);
      transaction.oncomplete = () => {
        resolve();
      };
      transaction.onerror = () => {
        reject(new Error('VAULT_STORAGE_FAILED'));
      };
      transaction.onabort = () => {
        reject(new Error('VAULT_STORAGE_FAILED'));
      };
    });
  } finally {
    db.close();
  }
}
export const saveVault = (envelope: VaultEnvelope, backupDownloaded = false) =>
  dbPut('vault', 'account', savedSchema.parse({ envelope, backupDownloaded }));
export async function loadVault() {
  const value = await dbGet('vault', 'account');
  return value === undefined ? null : savedSchema.parse(value);
}
