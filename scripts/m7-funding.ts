import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { EthNativeSigner } from '@qorechain/sdk';
import { StargateClient } from '@cosmjs/stargate';
import { sha256 } from 'viem';
import { z } from 'zod';
import { loadAccount } from '../packages/chain/src/accounts.js';
import { parseConfig } from '../packages/chain/src/config.js';
const root = new URL('../', import.meta.url);
export async function fundM7(role: 'client' | 'business', amount: string) {
  const output = new URL(`evidence/m7-funding-${role}.json`, root),
    checkpoint = new URL(`.accounts/m7-browser/funding-${role}.json`, root);
  if (existsSync(output)) return;
  const config = parseConfig(JSON.parse(readFileSync(new URL('config/diana.json', root), 'utf8')) as unknown);
  const recipient = z
    .object({ cosmos: z.string() })
    .passthrough()
    .parse(JSON.parse(readFileSync(new URL(`.accounts/${role}.json`, root), 'utf8')) as unknown).cosmos;
  const schema = z.object({ raw: z.string(), hash: z.string(), submitted: z.boolean() }).strict();
  let saved;
  if (existsSync(checkpoint)) saved = schema.parse(JSON.parse(readFileSync(checkpoint, 'utf8')) as unknown);
  else {
    const account = await loadAccount(new URL('.accounts', root).pathname, 'deployer');
    const response = await fetch(`${config.rest}/cosmos/auth/v1beta1/accounts/${account.cosmos}`);
    const sequence = z.object({ account_number: z.string(), sequence: z.string() }).passthrough();
    const data = z
      .object({ account: z.union([sequence, z.object({ base_account: sequence }).passthrough()]) })
      .passthrough()
      .parse(await response.json());
    const state =
      'base_account' in data.account ? sequence.parse(data.account.base_account) : sequence.parse(data.account);
    const signer = new EthNativeSigner(account, { signMode: 'hybrid', rest: config.rest });
    const signed = signer.sign({
      chainId: config.nativeChainId,
      accountNumber: BigInt(state.account_number),
      sequence: BigInt(state.sequence),
      fee: { amount: [{ denom: 'uqor', amount: '100000' }], gas: '800000' },
      messages: [
        {
          typeUrl: '/cosmos.bank.v1beta1.MsgSend',
          value: { fromAddress: account.cosmos, toAddress: recipient, amount: [{ denom: 'uqor', amount }] },
        },
      ],
      signBytesVersion: await signer.resolveSignBytesVersion(config.nativeChainId),
    });
    saved = {
      raw: Buffer.from(signed.txRawBytes).toString('base64'),
      hash: sha256(signed.txRawBytes).slice(2).toUpperCase(),
      submitted: false,
    };
    writeFileSync(checkpoint, JSON.stringify(saved), { mode: 0o600 });
  }
  const client = await StargateClient.connect(config.consensusRpc);
  try {
    if (!saved.submitted) {
      saved.submitted = true;
      writeFileSync(checkpoint, JSON.stringify(saved), { mode: 0o600 });
      await client.broadcastTx(Buffer.from(saved.raw, 'base64'), 120000, 2000);
    }
    const receipt = await client.getTx(saved.hash);
    if (!receipt) throw new Error('OUTCOME_UNKNOWN');
    if (receipt.code !== 0) throw new Error('FUNDING_REVERTED');
    const evidence = {
      command: 'pnpm evidence --m7',
      at: new Date().toISOString(),
      purpose: 'public demo setup funding; browser payments remain separate',
      role,
      amountUqor: amount,
      hash: receipt.hash,
      height: receipt.height,
      gasUsed: receipt.gasUsed.toString(),
      code: receipt.code,
    };
    writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    client.disconnect();
  }
}
