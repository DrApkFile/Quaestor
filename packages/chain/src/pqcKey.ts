import {
  buildRegisterPqcKeyMsg,
  fetchPqcStatus,
  isRegisteredPqcKey,
  signProofOfPossession,
  type UnifiedAccount,
} from '@qorechain/sdk';
import type { ChainConfig } from './config.js';
import { broadcastNative } from './native.js';
export async function registerPqcKey(config: ChainConfig, account: UnifiedAccount) {
  const read = () => fetchPqcStatus({ rest: config.rest, address: account.cosmos });
  const status = await read();
  if (status.registered) {
    if (isRegisteredPqcKey(status, account.pqc.publicKey) !== true || status.possessionProven !== true) {
      throw new Error('PQ_POSSESSION_NOT_PROVEN');
    }
    return { kind: 'ALREADY_REGISTERED' } as const;
  }
  const proofOfPossession = signProofOfPossession({
    chainId: config.nativeChainId,
    account: account.cosmos,
    keypair: account.pqc,
  });
  const message = buildRegisterPqcKeyMsg(account.cosmos, { pqcKeypair: account.pqc, proofOfPossession });
  const transaction = await broadcastNative(config, account, 'classical', [message]);
  const confirmed = await read();
  if (isRegisteredPqcKey(confirmed, account.pqc.publicKey) !== true || confirmed.possessionProven !== true) {
    throw new Error('PQ_POSSESSION_NOT_PROVEN');
  }
  return { kind: 'REGISTERED', transaction } as const;
}
