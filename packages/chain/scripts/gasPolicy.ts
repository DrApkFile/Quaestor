import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { createPublicClient, http } from 'viem';
import { parseConfig, uintSchema } from '../src/config.js';
import { dianaChain } from '../src/network.js';
import { writePrivateJson } from '../src/storage.js';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const config = parseConfig(JSON.parse(readFileSync(`${root}/config/diana.json`, 'utf8')) as unknown);
const reader = createPublicClient({ chain: dianaChain, transport: http(config.evmRpc) });
if ((await reader.getChainId()) !== config.chainId) throw new Error('CHAIN_MISMATCH');
const block = await reader.getBlockNumber({ cacheTime: 0 });
const path = '/cosmos/evm/feemarket/v1/params';
const response = await fetch(`${config.rest}${path}`, { headers: { 'x-cosmos-block-height': block.toString() } });
if (!response.ok) throw new Error('GAS_POLICY_READ_FAILED');
const body: unknown = await response.json();
const decimal = z.string().regex(/^\d+(\.\d+)?$/);
const parsed = z
  .object({
    params: z
      .object({
        no_base_fee: z.boolean(),
        base_fee_change_denominator: z.number().int(),
        elasticity_multiplier: z.number().int(),
        enable_height: uintSchema,
        base_fee: decimal,
        min_gas_price: decimal,
        min_gas_multiplier: decimal,
      })
      .strict(),
  })
  .strict()
  .parse(body);
const responseHeight = response.headers.get('x-cosmos-block-height');
if (responseHeight !== null && responseHeight !== block.toString()) throw new Error('GAS_POLICY_HEIGHT_MISMATCH');
const evidence = {
  command: 'pnpm evidence --m1-gas-policy',
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  at: new Date().toISOString(),
  network: config.nativeChainId,
  requestedBlock: block.toString(),
  responseHeight,
  endpoint: path,
  ...parsed,
};
writePrivateJson(`${root}/evidence/m1-gas-policy.json`, evidence);
console.log(JSON.stringify(evidence, null, 2));
