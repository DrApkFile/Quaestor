import { z } from 'zod';
import { existsSync } from 'node:fs';
import { readJson } from './m3Shared.js';
import { writePrivateJson } from '../src/storage.js';
import { hexSchema } from '../src/config.js';
import { toHex, hexToBytes, zeroAddress } from 'viem';
import { artifact } from './m3Shared.js';
import { m4Dir } from './m4State.js';
import { m2Root, type M2Context } from './m2Context.js';
import { resolveCard } from '../src/tickets/card.js';
import { sealTicket, ticketMetadata } from '../src/tickets/ticket.js';
import { postTicket, scanMemos } from '../src/tickets/memoBoard.js';
import { receiveMemo } from '../src/tickets/receive.js';
import { syncPoolTree } from '../src/tree.js';
import { createGateway } from '../src/gateway.js';
import type { StoredNote } from '../src/journal.js';
import { paymentEvidence } from '../src/evidence.js';
export async function payM4(payer: M2Context, payee: M2Context, id: string, input: StoredNote, amount: bigint) {
  const block = await payer.reader.getBlockNumber({ cacheTime: 0 });
  const [recipient, self] = await Promise.all(
    [payee, payer].map((context) =>
      resolveCard(payer.config, `${m2Root}/cards/${context.account.cosmos}.json`, context.account.cosmos, block),
    ),
  );
  if (!recipient || !self || recipient.kind !== 'VERIFIED' || self.kind !== 'VERIFIED') throw new Error('CARD_INVALID');
  const send = await payer.pool.privateSend(id, input.commitment, amount, payee.role);
  if (send.kind !== 'LANDED' || !send.operation.prepared) throw new Error(send.kind);
  const note = send.operation.prepared.outputs.find((note) => note.owner === payee.role);
  const change = send.operation.prepared.outputs.find((note) => note.owner === payer.role);
  if (!note || !change) throw new Error('NOTE_REQUIRED');
  const generated = await sealTicket(
    {
      v: 1,
      secret: note.secret,
      commitment: note.commitment,
      nullifier: note.nullifier,
      amountWei: note.amountWei,
      asset: note.asset,
      pool: payer.config.pool,
      chainId: 9800,
    },
    [recipient, self],
  );
  const cached = artifact(
    `${m4Dir}/${id}-ticket.json`,
    z
      .object({
        hex: z
          .string()
          .regex(/^0x[\da-f]+$/)
          .transform((value) => value as `0x${string}`),
      })
      .strict(),
    () => ({ hex: toHex(generated) }),
  );
  const bytes = hexToBytes(cached.hex);
  const posted = await postTicket(
    payer.journal,
    id,
    note.commitment,
    bytes,
    payer.memoAbi,
    createGateway(payer.config, payer.account, payer.reader, payer.poolAbi, payer.board.address),
  );
  if (posted.kind !== 'LANDED') throw new Error(posted.kind);
  const opened = await openPayeeM4(payee, note, id);
  return {
    note,
    change,
    evidence: {
      send: paymentEvidence(send.operation),
      memo: paymentEvidence(posted.operation),
      ticket: { ...ticketMetadata(bytes), anonymous: true },
      opened,
    },
  };
}
const openedSchema = z
  .object({
    kind: z.literal('OPENED'),
    commitment: hexSchema,
    treeBlock: z.string(),
    root: hexSchema,
    treeIncluded: z.literal(true),
  })
  .strict();
async function openPayeeM4(payee: M2Context, note: StoredNote, id: string) {
  const path = `${m4Dir}/${id}-opened.json`;
  if (existsSync(path)) {
    const opened = openedSchema.parse(readJson(path));
    if (opened.commitment !== note.commitment) throw new Error('OPEN_CACHE_MISMATCH');
    return opened;
  }
  const at = await payee.reader.getBlockNumber({ cacheTime: 0 });
  const memos = await scanMemos(payee.reader, payee.memoAbi, payee.board, at);
  const memo = memos.find((memo) => memo.commitment === note.commitment);
  if (!memo) throw new Error('MEMO_REQUIRED');
  const tree = await syncPoolTree(payee.reader, payee.config, payee.poolAbi, at);
  const opened = await receiveMemo(
    payee.journal,
    memo,
    payee.sealKeys,
    payee.config.pool,
    at,
    (commitment, nullifier, block) =>
      Promise.resolve().then(async () => {
        const spent: unknown = await payee.reader.readContract({
          address: payee.config.pool,
          abi: payee.poolAbi,
          functionName: 'spent',
          args: [nullifier],
          blockNumber: block,
        });
        if (typeof spent !== 'boolean') throw new Error('SPENT_STATUS_INVALID');
        return { included: tree.tree.indexByCommitment.has(commitment.toLowerCase()), spent, root: tree.tree.root };
      }),
  );
  if (opened.kind !== 'OPENED') throw new Error(opened.code);
  writePrivateJson(path, opened);
  return opened;
}
export async function clientInput(context: M2Context) {
  const shield = await context.pool.shield('m4-client-shield', zeroAddress, 2_000_000_000_000_000_000n);
  if (shield.kind !== 'LANDED' || !shield.operation.prepared) throw new Error(shield.kind);
  const note = shield.operation.prepared.outputs[0];
  if (!note) throw new Error('NOTE_REQUIRED');
  return { note, evidence: paymentEvidence(shield.operation) };
}
