import { deriveSealKeys, type SealKeyPair } from '@qorechain/qoreseal';
import type { UnifiedAccount } from '@qorechain/sdk';
export function accountSealKeys(account: UnifiedAccount): SealKeyPair {
    if (!account.mnemonic)
        throw new Error('SEAL_MNEMONIC_REQUIRED');
    return deriveSealKeys({ mnemonic: account.mnemonic, index: 0 });
}
export function sealSecrets(keys: SealKeyPair): string[] {
    return [keys.seed, keys.mlkemSecretKey, keys.x25519SecretKey].flatMap(bytes => [
        Buffer.from(bytes).toString('hex'), Buffer.from(bytes).toString('base64'),
    ]);
}
