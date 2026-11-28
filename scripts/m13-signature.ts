import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { IQORE_PQC_ABI } from '@qorechain/evm';
import { encodeFunctionData, decodeFunctionResult } from 'viem';
import { hexSchema, addressSchema } from '../packages/chain/src/config.js';
const root = new URL('../', import.meta.url);
const fixture = z
  .object({ publicKey: hexSchema, signature: hexSchema, digest: hexSchema, owner: addressSchema })
  .passthrough()
  .parse(JSON.parse(readFileSync(new URL('evidence/m12-hedged-close.json', root), 'utf8')) as unknown);
const rpc = 'https://evm-testnet.qore.host';
async function request(method: string, params: unknown[]) {
  const response = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error('RPC_HTTP_FAILED');
  return z
    .object({
      result: z.unknown().optional(),
      error: z.object({ code: z.number(), message: z.string(), data: z.unknown().optional() }).optional(),
    })
    .passthrough()
    .parse(await response.json());
}
const height = await request('eth_blockNumber', []);
const block = hexSchema.parse(height.result);
const header = await request('eth_getBlockByNumber', [block, false]);
const blockHash = z.object({ hash: hexSchema }).passthrough().parse(header.result).hash;
const address = '0x0000000000000000000000000000000000000a01';
const probes = [];
for (const [label, signature] of [
  ['valid control', fixture.signature],
  ['truncated', hexSchema.parse(fixture.signature.slice(0, -2))],
  ['empty', '0x'],
] as const) {
  const data = encodeFunctionData({
    abi: IQORE_PQC_ABI,
    functionName: 'pqcVerify',
    args: [fixture.publicKey, signature, fixture.digest],
  });
  const response = await request('eth_call', [{ to: address, data }, block]);
  if (response.error && !/revert/i.test(response.error.message)) throw new Error('RPC_NON_REVERT_ERROR');
  const accepted = response.error
    ? null
    : decodeFunctionResult({ abi: IQORE_PQC_ABI, functionName: 'pqcVerify', data: hexSchema.parse(response.result) });
  probes.push({
    label,
    signatureBytes: (signature.length - 2) / 2,
    request: { method: 'eth_call', params: [{ to: address, data }, block] },
    response,
    accepted,
  });
}
const passed =
  probes[0]?.accepted === true && probes.slice(1).every((probe) => probe.accepted === false || probe.response.error);
const report = {
  command: 'pnpm evidence --m13-signature',
  at: new Date().toISOString(),
  network: 'qorechain-diana',
  chainId: 9800,
  rpc,
  block,
  blockHash,
  publicFixture: 'evidence/m12-hedged-close.json',
  owner: fixture.owner,
  publicKey: fixture.publicKey,
  probes,
  status: passed ? 'PASSED' : 'FAILED',
  scope: 'Read-only pinned eth_call; public key and existing public signatures only, no transaction.',
};
writeFileSync(new URL('evidence/m13-short-signature.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(
  `M13 signature probes at ${block}: ${probes.map((probe) => `${probe.label}=${String(probe.accepted)}`).join(', ')}; ${report.status}`,
);
if (!passed) process.exitCode = 1;
