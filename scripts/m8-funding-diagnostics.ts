import { readFileSync, writeFileSync } from 'node:fs';
import { StargateClient } from '@cosmjs/stargate';
import { createPublicClient, http, formatEther } from 'viem';
import { z } from 'zod';
import { parseConfig, addressSchema } from '../packages/chain/src/config.js';
const root = new URL('../', import.meta.url);
const config = parseConfig(JSON.parse(readFileSync(new URL('config/diana.json', root), 'utf8')) as unknown);
const saved = z
  .object({ hash: z.string() })
  .passthrough()
  .parse(JSON.parse(readFileSync(new URL('.accounts/m7b-browser/funding-client.json', root), 'utf8')) as unknown);
const native = await StargateClient.connect(config.consensusRpc);
try {
  const receipt = await native.getTx(saved.hash);
  if (!receipt) throw new Error('FUNDING_OUTCOME_UNKNOWN');
  const client = createPublicClient({ transport: http(config.evmRpc) });
  const block = await client.getBlockNumber({ cacheTime: 0 });
  const balances = [];
  for (const role of ['deployer', 'client', 'business'] as const) {
    const account = z
      .object({ evm: addressSchema })
      .passthrough()
      .parse(JSON.parse(readFileSync(new URL(`.accounts/${role}.json`, root), 'utf8')) as unknown);
    const balance = await client.getBalance({ address: account.evm, blockNumber: block });
    balances.push({ role, address: account.evm, publicQor: formatEther(balance) });
  }
  const evidence = {
    command: 'pnpm evidence --m8-funding-diagnostics',
    at: new Date().toISOString(),
    status: receipt.code === 0 ? 'LANDED' : 'REVERTED',
    hash: receipt.hash,
    height: receipt.height,
    code: receipt.code,
    rawLog: receipt.rawLog.slice(0, 500),
    balanceBlock: block.toString(),
    balances,
    scope:
      'Setup funding only; no book or payment was created by this failed M7b attempt. Existing signed checkpoint is retained and not rebroadcast.',
  };
  writeFileSync(new URL('evidence/m7b-funding-attempt.json', root), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  native.disconnect();
}
