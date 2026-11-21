import type { SealKeyPair } from '@qorechain/qoreseal';
import type { Hex } from 'viem';
import { Journal } from '../journal.js';
import { openTicket, TicketError } from './ticket.js';
export interface Memo {
  commitment: Hex;
  envelope: Uint8Array;
  hash: Hex;
  block: bigint;
}
export interface Inclusion {
  included: boolean;
  spent: boolean;
  root: Hex;
}
export async function receiveMemo(
  journal: Journal,
  memo: Memo,
  keys: SealKeyPair,
  pool: string,
  block: bigint,
  check: (commitment: Hex, nullifier: Hex, block: bigint) => Promise<Inclusion>,
) {
  const owner = journal.owner;
  if (!owner) throw new Error('JOURNAL_OWNER_REQUIRED');
  try {
    const note = await openTicket(memo.envelope, keys, pool, memo.commitment);
    const inclusion = await check(note.commitment, note.nullifier, block);
    if (!inclusion.included || inclusion.spent || memo.block > block) throw new TicketError('TICKET_INVALID');
    await journal.exclusive(() => {
      return Promise.resolve().then(() => {
        const data = journal.read();
        const existing = data.notes.find((item) => item.commitment === note.commitment);
        if (existing && existing.state !== 'INCOMING' && existing.state !== 'OWNED')
          throw new TicketError('TICKET_INVALID');
        if (existing) existing.state = 'OWNED';
        else
          data.notes.push({
            secret: note.secret,
            commitment: note.commitment,
            nullifier: note.nullifier,
            amountWei: note.amountWei,
            asset: note.asset,
            owner,
            state: 'OWNED',
          });
        journal.save(data);
      });
    });
    return {
      kind: 'OPENED',
      commitment: note.commitment,
      treeBlock: block.toString(),
      root: inclusion.root,
      treeIncluded: true,
    } as const;
  } catch (error: unknown) {
    if (error instanceof TicketError)
      return { kind: 'REFUSED', code: error.code, commitment: memo.commitment } as const;
    const candidate = error instanceof Error ? ('code' in error ? error.code : error.message) : undefined;
    const code = typeof candidate === 'string' && /^[A-Z_]+$/.test(candidate) ? candidate : 'RECEIVE_FAILED';
    return { kind: 'REFUSED', code, commitment: memo.commitment } as const;
  }
}
