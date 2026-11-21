import { createPublicClient, http, type PublicClient } from 'viem';
import { deploymentSchema, dianaChain, type AuditConfig } from '@quaestor/chain/browser';
import raw from '../../../config/m5.json';
import { cachedVkey, type DownloadProgress } from './circuits.js';
export const deployment = deploymentSchema.parse(raw);
const base = deployment.chain;
export const browserChain = {
  ...base,
  rest: `${location.origin}/api/qore/rest`,
  consensusRpc: `${location.origin}/api/qore/rpc`,
};
export const client: PublicClient = createPublicClient({
  chain: dianaChain,
  transport: http(base.evmRpc, { retryCount: 0 }),
});
export const readerConfig = (progress: (value: DownloadProgress) => void): AuditConfig => ({
  client,
  chain: browserChain,
  books: deployment.books,
  board: deployment.board,
  legacyBooks: deployment.legacyBooks,
  vkey: (name) => cachedVkey(name, progress),
});
