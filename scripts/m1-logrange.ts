import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPublicClient, http, type PublicClient } from 'viem';
import { dianaChain, loadPoolAbi, parseConfig, syncPoolTree } from '../packages/chain/src/index.js';
import { writePrivateJson } from '../packages/chain/src/storage.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const config = parseConfig(JSON.parse(readFileSync(`${root}/config/diana.json`, 'utf8')) as unknown);
const client = createPublicClient({ chain: dianaChain, transport: http(config.evmRpc, { retryCount: 0 }) });
if ((await client.getChainId()) !== config.chainId) throw new Error('CHAIN_MISMATCH');
const block = await client.getBlockNumber({ cacheTime: 0 });
const requests: {
  from: string;
  to: string;
  logs: number;
}[] = [];
const reader: PublicClient = Object.assign({}, client, {
  getLogs: (async (parameters: Parameters<PublicClient['getLogs']>[0]) => {
    if (!parameters) throw new Error('LOG_RANGE_REQUIRED');
    const logs = await client.getLogs(parameters);
    requests.push({ from: String(parameters.fromBlock), to: String(parameters.toBlock), logs: logs.length });
    return logs;
  }) as PublicClient['getLogs'],
});
const abi = loadPoolAbi(`${root}/contracts/out/ShieldPoolPayments.sol/ShieldPoolPayments.json`);
const result = await syncPoolTree(reader, { ...config, chunkSize: 500n }, abi, block);
const evidence = {
  command: 'pnpm evidence --m1-logs',
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  at: new Date().toISOString(),
  network: config.nativeChainId,
  pool: config.pool,
  fromBlock: config.deployBlock.toString(),
  toBlock: block.toString(),
  requestedRange: '500',
  effectiveRange: result.logRange.toString(),
  requests,
  leafCount: result.tree.leafCount,
  root: result.tree.root,
  rootMatchesPinnedCurrentRoot: true,
  capEncountered: result.logRange < 500n,
};
writePrivateJson(`${root}/evidence/m1-logrange.json`, evidence);
console.log(JSON.stringify(evidence, null, 2));
