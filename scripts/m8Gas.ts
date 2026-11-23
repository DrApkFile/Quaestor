import { readFileSync, writeFileSync } from 'node:fs';
import { createPublicClient, http, formatEther, parseEther } from 'viem';
import { z } from 'zod';
import { parseConfig, addressSchema } from '../packages/chain/src/config.js';
const root = new URL('../', import.meta.url);
export async function requireM7bGas() {
  const config = parseConfig(JSON.parse(readFileSync(new URL('config/diana.json', root), 'utf8')) as unknown);
  const client = createPublicClient({ transport: http(config.evmRpc) });
  const block = await client.getBlockNumber({ cacheTime: 0 });
  const balances = [];
  for (const [role, minimum] of [
    ['client', '3'],
    ['business', '6'],
  ] as const) {
    const account = z
      .object({ evm: addressSchema })
      .passthrough()
      .parse(JSON.parse(readFileSync(new URL(`.accounts/${role}.json`, root), 'utf8')) as unknown);
    const balance = await client.getBalance({ address: account.evm, blockNumber: block });
    if (balance < parseEther(minimum)) throw new Error('DEMO_GAS_FUNDING_REQUIRED');
    balances.push({ role, address: account.evm, publicQor: formatEther(balance), minimumDemoGasQor: minimum });
  }
  const evidence = {
    command: 'pnpm evidence --m7b',
    at: new Date().toISOString(),
    status: 'READY',
    block: block.toString(),
    balances,
    funding:
      'Existing public testnet balances; no additional funding transaction. The earlier reverted optional funding attempt remains separately recorded.',
    scope: 'Setup readiness against demo gas allowances, not a guarantee about future fees or private holdings.',
  };
  writeFileSync(new URL('evidence/m7b-gas-readiness.json', root), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
}
