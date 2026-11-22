import { it, expect } from 'vitest';
import { generateMnemonic, deriveUnifiedAccount } from '@qorechain/sdk';
import { deriveSealKeys } from '@qorechain/qoreseal';
import { privateMatcher } from '../src/privacy.js';
import { toBytes } from 'viem';
import { encryptVault, decryptVault } from '../src/vault.js';
it('T-VAULT wrong passphrase fails and an encrypted backup restores the same account addresses', async () => {
  const mnemonic = generateMnemonic();
  const original = await deriveUnifiedAccount(mnemonic, 0);
  const seal = deriveSealKeys({ mnemonic, index: 0 });
  const note = `0x${'72'.repeat(32)}`;
  for (const value of [
    mnemonic,
    Buffer.from(toBytes(original.privateKey)).toString('base64'),
    Buffer.from(seal.mlkemSecretKey).toString('hex'),
    BigInt(note).toString(),
  ]) {
    expect(privateMatcher(original, seal, [note], value)).toBe(true);
    expect(privateMatcher(original, seal, [note], Buffer.from(value).toString('hex'))).toBe(true);
  }
  expect(privateMatcher(original, seal, [note], '{"jsonrpc":"2.0","method":"eth_blockNumber"}')).toBe(false);
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
