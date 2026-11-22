import { EthNativeSigner, type UnifiedAccount, type EncodeObject } from '@qorechain/sdk';
import type { Registry } from '@cosmjs/proto-signing';
import { StargateClient } from '@cosmjs/stargate';
import { sha256 } from 'viem';
import { z } from 'zod';
import { NativeBroadcastError, accountSecrets, nativeFailureSchema } from '@quaestor/chain/browser';
import { dbGet, dbPut } from './db.js';
import { browserChain } from './client.js';
const pendingSchema = z
  .object({
    id: z.string(),
    hash: z.string().regex(/^[\dA-F]{64}$/),
    raw: z.string(),
    stage: z.enum(['SIGNED', 'SUBMITTED', 'LANDED']),
    height: z.number().optional(),
    code: z.number().optional(),
    failure: nativeFailureSchema.optional(),
  })
  .strict();
export async function nativeAction(
  account: UnifiedAccount,
  backupDownloaded: boolean,
  id: string,
  mode: 'classical' | 'hybrid',
  messages: readonly EncodeObject[],
  registry?: Registry,
) {
  if (!backupDownloaded) throw new Error('BACKUP_REQUIRED');
  const key = `native:${account.cosmos}`;
  const saved = await dbGet('journal', key);
  let pending = saved === undefined ? null : pendingSchema.parse(saved);
  const transport = await StargateClient.connect(browserChain.consensusRpc);
  try {
    if (pending && pending.stage !== 'LANDED') {
      const receipt = await transport.getTx(pending.hash);
      if (!receipt) throw new Error('OUTCOME_UNKNOWN');
      const failure =
        receipt.code !== 0 ? new NativeBroadcastError(receipt, accountSecrets(account)).fields() : undefined;
      pending = {
        ...pending,
        stage: 'LANDED',
        height: receipt.height,
        code: receipt.code,
        ...(failure ? { failure } : {}),
      };
      await dbPut('journal', key, pending);
    }
    if (pending?.id === id && pending.stage === 'LANDED') {
      if (pending.code !== 0)
        throw new NativeBroadcastError(pending.failure ?? { code: pending.code }, accountSecrets(account));
      return;
    }
    const response = await fetch(`${browserChain.rest}/cosmos/auth/v1beta1/accounts/${account.cosmos}`);
    if (!response.ok) throw new Error('NETWORK_UNAVAILABLE');
    const seq = z.object({ account_number: z.string(), sequence: z.string() }).passthrough();
    const value = z
      .object({ account: z.union([z.object({ base_account: seq }).passthrough(), seq]) })
      .passthrough()
      .parse(await response.json());
    const current = 'base_account' in value.account ? seq.parse(value.account.base_account) : seq.parse(value.account);
    const signer = new EthNativeSigner(account, {
      signMode: mode,
      rest: browserChain.rest,
      ...(registry ? { registry } : {}),
    });
    const version = await signer.resolveSignBytesVersion('qorechain-diana');
    const signed = signer.sign({
      chainId: 'qorechain-diana',
      accountNumber: BigInt(current.account_number),
      sequence: BigInt(current.sequence),
      messages,
      fee: { amount: [{ denom: 'uqor', amount: '100000' }], gas: '800000' },
      signBytesVersion: version,
    });
    const raw = Buffer.from(signed.txRawBytes).toString('base64');
    pending = { id, hash: sha256(signed.txRawBytes).slice(2).toUpperCase(), raw, stage: 'SIGNED' };
    await dbPut('journal', key, pending);
    pending = { ...pending, stage: 'SUBMITTED' };
    await dbPut('journal', key, pending);
    try {
      const receipt = await transport.broadcastTx(signed.txRawBytes, 60000, 2000);
      const failure = receipt.code !== 0 ? new NativeBroadcastError(receipt, accountSecrets(account)) : null;
      await dbPut('journal', key, {
        ...pending,
        stage: 'LANDED',
        height: receipt.height,
        code: receipt.code,
        ...(failure ? { failure: failure.fields() } : {}),
      });
      if (failure) throw failure;
    } catch (error: unknown) {
      if (error instanceof NativeBroadcastError) throw error;
      throw new Error('OUTCOME_UNKNOWN');
    }
  } finally {
    transport.disconnect();
  }
}
