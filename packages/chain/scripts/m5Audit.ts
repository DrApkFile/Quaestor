import { z } from 'zod';
import { m2Context, m2Root } from './m2Context.js';
import { readJson } from './m3Shared.js';
import { auditFromChain } from '../src/chainAudit.js';
import { publicCheck } from '../src/publicCheck.js';
import { parseConfig, addressSchema, hexSchema } from '../src/config.js';
export const m5ConfigSchema = z
  .object({
    chain: z.unknown(),
    books: z.object({ address: addressSchema, deployBlock: z.string(), chunkSize: z.string() }).strict(),
    board: z.object({ address: addressSchema, deployBlock: z.string(), chunkSize: z.string() }).strict(),
    legacyBooks: z.record(z.enum(['honest', 'attack'])),
    demo: z.object({ honest: hexSchema, attack: hexSchema, periodA: z.string(), periodB: z.string() }).strict(),
  })
  .strict();
export async function auditM5() {
  const publicConfig = m5ConfigSchema.parse(readJson(`${m2Root}/config/m5.json`));
  const context = await m2Context('auditor', 'm5-auditor');
  const reader = {
    client: context.reader,
    chain: parseConfig(publicConfig.chain),
    books: {
      ...publicConfig.books,
      deployBlock: BigInt(publicConfig.books.deployBlock),
      chunkSize: BigInt(publicConfig.books.chunkSize),
    },
    board: {
      ...publicConfig.board,
      deployBlock: BigInt(publicConfig.board.deployBlock),
      chunkSize: BigInt(publicConfig.board.chunkSize),
    },
    legacyBooks: publicConfig.legacyBooks,
    vkey: (name: 'receipt' | 'funds') =>
      Promise.resolve(readJson(`${m2Root}/apps/web/public/circuits/${name}_vkey.json`)),
  };
  const identity = { address: context.account.cosmos, keys: context.sealKeys };
  const honest = await auditFromChain(reader, publicConfig.demo.honest, identity);
  const attack = await auditFromChain(reader, publicConfig.demo.attack, identity);
  const publicView = await publicCheck(reader, publicConfig.demo.honest);
  return {
    pid: process.pid,
    loadedAccounts: ['auditor'],
    ciphertextSource: 'BlobBoard only; no local ciphertext manifest',
    honest,
    attack,
    publicCheck: publicView,
  };
}
