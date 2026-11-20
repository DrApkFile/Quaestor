import { readFileSync } from 'node:fs';
import { deriveUnifiedAccount } from '@qorechain/sdk';
import { z } from 'zod';
import { addressSchema } from './config.js';

export const roleSchema = z.enum(['deployer', 'business', 'client', 'supplier1', 'supplier2', 'auditor']);
export type Role = z.infer<typeof roleSchema>;
const accountSchema = z.object({
  role: roleSchema,
  network: z.literal('qorechain-diana (testnet only)'),
  mnemonic: z.string().min(1),
  cosmos: z.string().startsWith('qor1'),
  evm: addressSchema,
}).strict();

export async function loadAccount(directory: string, role: Role) {
  const parsed: unknown = JSON.parse(readFileSync(`${directory}/${roleSchema.parse(role)}.json`, 'utf8'));
  const result = accountSchema.safeParse(parsed);
  if (!result.success) throw new Error('ACCOUNT_FILE_INVALID');
  const saved = result.data;
  const account = await deriveUnifiedAccount(saved.mnemonic, 0);
  if (saved.role !== role || saved.cosmos !== account.cosmos || saved.evm.toLowerCase() !== account.evm.toLowerCase()) {
    throw new Error('ACCOUNT_FILE_INVALID');
  }
  return account;
}
