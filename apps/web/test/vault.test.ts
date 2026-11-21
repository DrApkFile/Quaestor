import { it, expect } from 'vitest';
import { generateMnemonic, deriveUnifiedAccount } from '@qorechain/sdk';
import { encryptVault, decryptVault } from '../src/vault.js';
it('T-VAULT wrong passphrase fails and an encrypted backup restores the same account addresses', async () => {
  const mnemonic = generateMnemonic();
  const original = await deriveUnifiedAccount(mnemonic, 0);
  const passphrase = 'synthetic-test-passphrase-only';
  const backup = await encryptVault(mnemonic, passphrase);
  expect(backup.N).toBe(131072);
  expect(JSON.stringify(backup)).not.toContain(mnemonic);
  expect(JSON.stringify(backup)).not.toContain(original.privateKey);
  await expect(decryptVault(backup, 'wrong synthetic passphrase')).rejects.toThrow('INVALID_PASSPHRASE_OR_BACKUP');
  const restored = await deriveUnifiedAccount((await decryptVault(backup, passphrase)).mnemonic, 0);
  expect(restored.cosmos).toBe(original.cosmos);
  expect(restored.evm).toBe(original.evm);
  const changed = {
    ...backup,
    ciphertext: `${backup.ciphertext.startsWith('A') ? 'B' : 'A'}${backup.ciphertext.slice(1)}`,
  };
  await expect(decryptVault(changed, passphrase)).rejects.toThrow('INVALID_PASSPHRASE_OR_BACKUP');
});
