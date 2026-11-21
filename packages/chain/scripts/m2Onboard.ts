import { existsSync, readFileSync } from 'node:fs';
import { registerPqcKey } from '../src/pqcKey.js';
import { accountSecrets } from '../src/nativeError.js';
import { registerKemKey, readRegistry } from '../src/tickets/kemRegistry.js';
import { createCard, verifyCard, saveCard } from '../src/tickets/card.js';
import { sealSecrets } from '../src/tickets/sealKeys.js';
import { m2Root, type M2Context } from './m2Context.js';
import { sha3, type M2Evidence } from './m2Evidence.js';
export async function onboardM2(context: M2Context, evidence: M2Evidence, save: () => void) {
  const { config, account, sealKeys, reader, role } = context;
  const pq = await registerPqcKey(config, account);
  if (pq.kind === 'REGISTERED') {
    evidence.nativeTransactions.push({ role, action: 'register-pq', ...pq.transaction });
    save();
  }
  const block = await reader.getBlockNumber({ cacheTime: 0 });
  const kem = await registerKemKey(config, account, sealKeys, block, (transaction) => {
    evidence.nativeTransactions.push({ role, action: 'register-kem', ...transaction });
    save();
  });
  if (kem.kind === 'KEM_REGISTRATION_FAILED') {
    evidence.failure = kem.failure;
    evidence.registryReason = kem.registryReason;
    save();
    throw new Error(kem.kind);
  }
  if (kem.kind === 'KEM_KEY_MISMATCH') throw new Error(kem.kind);
  const registryBlock = await reader.getBlockNumber({ cacheTime: 0 });
  const registry = await readRegistry(config, account.cosmos, registryBlock);
  const path = `${m2Root}/cards/${account.cosmos}.json`;
  let cardSha3: `0x${string}` | null = null;
  if (role !== 'client') {
    const input: unknown = existsSync(path)
      ? (JSON.parse(readFileSync(path, 'utf8')) as unknown)
      : createCard(account, sealKeys, new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'));
    if (verifyCard(input, registry).kind !== 'VERIFIED') throw new Error('CARD_INVALID');
    saveCard(path, input, [...accountSecrets(account), ...sealSecrets(sealKeys)]);
    cardSha3 = sha3(readFileSync(path));
  }
  evidence.identities = evidence.identities.filter((identity) => identity.role !== role);
  evidence.identities.push({
    role,
    address: account.cosmos,
    registryBlock: registryBlock.toString(),
    kemSha3: sha3(registry.mlkemPublicKey),
    cardSha3,
    cardVerified: role !== 'client',
  });
  save();
}
