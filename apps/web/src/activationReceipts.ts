import { z } from 'zod';
import { dbGet, dbPut } from './db.js';
import { BrowserJournal } from './browserJournal.js';
export const activationReceiptSchema = z.object({ id: z.string(), hash: z.string(), block: z.string() }).strict();
export type ActivationReceipt = z.infer<typeof activationReceiptSchema>;
export async function activationReceipts(address: string) {
  const key = `activation-receipts:${address}`;
  const saved = await dbGet('journal', key);
  const records = saved === undefined ? [] : z.array(activationReceiptSchema).parse(saved);
  const native = z
    .object({ id: z.string(), hash: z.string(), height: z.number(), stage: z.literal('LANDED'), code: z.literal(0) })
    .passthrough()
    .safeParse(await dbGet('journal', `native:${address}`));
  if (native.success && !records.some((record) => record.hash === native.data.hash))
    records.push({ id: native.data.id, hash: native.data.hash, block: String(native.data.height) });
  const journal = await BrowserJournal.open(address);
  for (const operation of journal.read().operations) {
    if (operation.receipt && operation.hash && !records.some((record) => record.hash === operation.hash))
      records.push({ id: operation.id, hash: operation.hash, block: operation.receipt.blockNumber });
  }
  await dbPut('journal', key, records);
  return records;
}
