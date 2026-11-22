import { z } from 'zod';
import type { UnifiedAccount } from '@qorechain/sdk';
import { database, dbGet, dbPut } from './db.js';
import { encryptVault, journalBackupSchema } from './vault.js';
const encrypted = z.object({ nonce: z.string(), ciphertext: z.string() }).strict();
function allowed(key: string, address: string) {
  return key.startsWith(`${address}:`) || key === `native:${address}`;
}
export async function accountRecords(address: string) {
  const db = await database();
  try {
    return await new Promise<z.infer<typeof journalBackupSchema>>((resolve, reject) => {
      const store = db.transaction('journal', 'readonly').objectStore('journal');
      const request = store.openCursor();
      const records: z.infer<typeof journalBackupSchema>['records'] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve({ address, records });
          return;
        }
        if (typeof cursor.key === 'string' && allowed(cursor.key, address)) {
          const value: unknown = cursor.value;
          if (cursor.key.startsWith(`${address}:`)) encrypted.parse(value);
          records.push({ key: cursor.key, value });
        }
        cursor.continue();
      };
      request.onerror = () => {
        reject(new Error('VAULT_STORAGE_FAILED'));
      };
    });
  } finally {
    db.close();
  }
}
export async function exportBackup(account: UnifiedAccount, passphrase: string) {
  if (!account.mnemonic) throw new Error('BACKUP_UNAVAILABLE');
  return encryptVault(account.mnemonic, passphrase, await accountRecords(account.cosmos));
}
export async function restoreJournal(address: string, input: unknown) {
  if (input === undefined) return;
  const saved = journalBackupSchema.parse(input);
  if (saved.address !== address || new Set(saved.records.map((row) => row.key)).size !== saved.records.length)
    throw new Error('INVALID_BACKUP');
  for (const row of saved.records) {
    if (!allowed(row.key, address)) throw new Error('INVALID_BACKUP');
    if (row.key.startsWith(`${address}:`)) encrypted.parse(row.value);
    const existing = await dbGet('journal', row.key);
    if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(row.value))
      throw new Error('JOURNAL_CONFLICT');
  }
  for (const row of saved.records) await dbPut('journal', row.key, row.value);
}
