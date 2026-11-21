import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createPublicClient, http, type PublicClient, type Abi } from 'viem';
import { z } from 'zod';
import type { UnifiedAccount } from '@qorechain/sdk';
import type { SealKeyPair } from '@qorechain/qoreseal';
import type { Gateway } from '../src/executor.js';
import type { BoardConfig } from '../src/tickets/memoBoard.js';
import { addressSchema, parseConfig, type ChainConfig } from '../src/config.js';
import { dianaChain } from '../src/network.js';
import { loadPoolAbi } from '../src/abi.js';
import { loadAccount, type Role } from '../src/accounts.js';
import { Journal } from '../src/journal.js';
import { createGateway } from '../src/gateway.js';
import { createPool } from '../src/pool.js';
import { createProver } from '../src/prover.js';
import { accountSealKeys } from '../src/tickets/sealKeys.js';
export const m2Root = fileURLToPath(new URL('../../../', import.meta.url));
export interface M2Context {
  role: Role;
  run: string;
  config: ChainConfig;
  reader: PublicClient;
  board: BoardConfig;
  poolAbi: Abi;
  memoAbi: Abi;
  account: UnifiedAccount;
  sealKeys: SealKeyPair;
  journal: Journal;
  gateway: Gateway;
  pool: ReturnType<typeof createPool>;
}
export async function m2Context(role: Role, run = 'm2'): Promise<M2Context> {
  const config = parseConfig(JSON.parse(readFileSync(`${m2Root}/config/diana.json`, 'utf8')) as unknown);
  const reader: PublicClient = createPublicClient({
    chain: dianaChain,
    transport: http(config.evmRpc, { retryCount: 0 }),
  });
  if ((await reader.getChainId()) !== config.chainId) throw new Error('CHAIN_MISMATCH');
  const raw: unknown = JSON.parse(readFileSync(`${m2Root}/evidence/m0-deploy.json`, 'utf8'));
  const deployment = z
    .object({
      contracts: z.array(
        z.object({ name: z.string(), address: addressSchema, block: z.number().int().nonnegative() }).passthrough(),
      ),
    })
    .passthrough()
    .parse(raw);
  const memo = deployment.contracts.find((contract) => contract.name === 'GloamPayMemo (memo board)');
  if (!memo) throw new Error('MEMO_DEPLOYMENT_REQUIRED');
  const board = { address: memo.address, deployBlock: BigInt(memo.block), chunkSize: 500n };
  const poolAbi = loadPoolAbi(`${m2Root}/contracts/out/ShieldPoolPayments.sol/ShieldPoolPayments.json`);
  const memoAbi = loadPoolAbi(`${m2Root}/contracts/out/GloamPayMemo.sol/GloamPayMemo.json`);
  const account = await loadAccount(`${m2Root}/.accounts`, role);
  const sealKeys = accountSealKeys(account);
  const journal = new Journal(`${m2Root}/.accounts/${run}/${role}.json`, role);
  const gateway = createGateway(config, account, reader, poolAbi);
  const pool = createPool({
    config,
    reader,
    abi: poolAbi,
    journal,
    gateway,
    owner: role,
    provers: {
      shield: createProver(`${m2Root}/apps/web/public/circuits`, 'shield'),
      transfer: createProver(`${m2Root}/apps/web/public/circuits`, 'transfer'),
      unshield: createProver(`${m2Root}/apps/web/public/circuits`, 'unshield'),
    },
  });
  return { role, run, config, reader, board, poolAbi, memoAbi, account, sealKeys, journal, gateway, pool };
}
