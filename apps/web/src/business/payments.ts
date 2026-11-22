import {
  scanMemos,
  openTicket,
  sealTicket,
  postTicket,
  TicketError,
  createPoolTreeSync,
  requireNotePath,
} from '@quaestor/chain/browser';
import { type Hex } from 'viem';
import { z } from 'zod';
import raw from '../../../../config/m6.json';
import { BusinessRuntime, browserChain, client, poolAbi, memoAbi } from './runtime.js';
import { resolvePair } from './recipients.js';
import { requireWindow } from './windows.js';
const memoConfig = z
  .object({
    memo: z
      .object({
        address: z.string().transform((value) => value as Hex),
        deployBlock: z.string().transform(BigInt),
        chunkSize: z.string().transform(BigInt),
      })
      .strict(),
  })
  .strict()
  .parse(raw).memo;
export async function pay(runtime: BusinessRuntime, address: string, asset: Hex, amount: bigint, id: string) {
  if (amount <= 0n || address === runtime.account.cosmos) throw new Error('INVALID_PAYMENT');
  await requireWindow(runtime, 2);
  const recipients = await resolvePair(runtime.account.cosmos, address);
  const plan = runtime.state.plans.find((value) => value.id === id);
  if (plan && (plan.payee !== address || plan.asset !== asset || plan.amount !== amount.toString()))
    throw new Error('REQUEST_CONFLICT');
  if (!plan) {
    runtime.state.plans.push({ id, payee: address, asset, amount: amount.toString() });
    await runtime.save();
  }
  const existing = runtime.state.payments.find((payment) => payment.id === id);
  const held = runtime.journal.read().operations.find((operation) => operation.id === id);
  const input =
    held?.input ??
    runtime.journal
      .read()
      .notes.filter(
        (note) =>
          note.state === 'OWNED' &&
          note.asset.toLowerCase() === asset.toLowerCase() &&
          BigInt(note.amountWei) >= amount,
      )
      .sort((a, b) => (BigInt(a.amountWei) < BigInt(b.amountWei) ? -1 : 1))[0]?.commitment;
  if (!input) throw new Error('INSUFFICIENT_PRIVATE_BALANCE');
  runtime.progress('Proving transfer');
  const operation = await runtime.requireResult(id, await runtime.pool().privateSend(id, input, amount, 'supplier1'));
  const note = operation.prepared?.outputs.find((output) => output.owner !== runtime.journal.owner);
  if (!note) throw new Error('PAYMENT_NOTE_MISSING');
  const payment = existing ?? {
    id,
    direction: 'OUT' as const,
    counterparty: address,
    note,
    memo: null,
    stage: 'SENT' as const,
    book: null,
    period: null,
    entryIndex: null,
  };
  if (!existing) runtime.state.payments.push(payment);
  await runtime.save();
  runtime.progress('Sent; posting anonymous ticket');
  const envelopeKey = `ticket:${id}`;
  const prior = await runtime.storage.get(envelopeKey);
  const envelope =
    prior === undefined
      ? await sealTicket(
          {
            v: 1,
            secret: note.secret,
            commitment: note.commitment,
            nullifier: note.nullifier,
            amountWei: note.amountWei,
            asset: note.asset,
            pool: browserChain.pool,
            chainId: 9800,
          },
          recipients,
        )
      : Uint8Array.from(z.array(z.number()).parse(prior));
  await runtime.storage.put(envelopeKey, Array.from(envelope));
  const result = await postTicket(
    runtime.journal,
    id,
    note.commitment,
    envelope,
    memoAbi,
    runtime.gateway(memoConfig.address),
  );
  const memo = await runtime.requireResult(`${id}-memo`, result);
  payment.memo = memo.hash;
  payment.stage = 'TICKET_POSTED';
  await runtime.save();
  runtime.progress('Ticket posted · Not booked');
}
export async function receive(runtime: BusinessRuntime) {
  const block = await client.getBlockNumber({ cacheTime: 0 });
  const start = BigInt(runtime.state.scanBlock) + 1n;
  if (start > block) return;
  const tree = await createPoolTreeSync(client, browserChain, poolAbi)(block);
  const memos = await scanMemos(
    client,
    memoAbi,
    { ...memoConfig, deployBlock: start > memoConfig.deployBlock ? start : memoConfig.deployBlock },
    block,
  );
  for (const memo of memos) {
    if (runtime.state.payments.some((payment) => payment.note.commitment === memo.commitment)) continue;
    try {
      const ticket = await openTicket(memo.envelope, runtime.sealKeys, browserChain.pool, memo.commitment);
      runtime.rememberSecret(ticket.secret);
      const tx = await client.getTransaction({ hash: memo.hash });
      if (tx.from.toLowerCase() === runtime.account.evm.toLowerCase()) continue;
      try {
        await requireNotePath(tree.tree, ticket.commitment);
      } catch {
        throw new TicketError('TICKET_INVALID');
      }
      const existingNote = runtime.journal.read().notes.find((note) => note.commitment === ticket.commitment);
      if (existingNote && existingNote.state !== 'OWNED') throw new Error('NOTE_SPENT');
      const spent = await client.readContract({
        address: browserChain.pool,
        abi: poolAbi,
        functionName: 'spent',
        args: [ticket.nullifier],
        blockNumber: block,
      });
      if (spent) throw new Error('NOTE_SPENT');
      const note = {
        secret: ticket.secret,
        commitment: ticket.commitment,
        nullifier: ticket.nullifier,
        amountWei: ticket.amountWei,
        asset: ticket.asset,
        owner: runtime.journal.owner,
        state: 'OWNED' as const,
      };
      const { parseAddress } = await import('@qorechain/qoresign');
      await runtime.journal.exclusive(async () => {
        const data = runtime.journal.read();
        if (!data.notes.some((item) => item.commitment === note.commitment)) data.notes.push(note);
        runtime.journal.save(data);
        await runtime.journal.flush();
      });
      runtime.state.payments.push({
        id: `received-${ticket.commitment.slice(2)}`,
        direction: 'IN',
        counterparty: parseAddress(tx.from).bech32,
        note,
        memo: memo.hash,
        stage: 'TICKET_POSTED',
        book: null,
        period: null,
        entryIndex: null,
      });
    } catch (error: unknown) {
      if (error instanceof TicketError && ['NOT_A_RECIPIENT', 'DECRYPTION_FAILED'].includes(error.code)) continue;
      if (
        !(error instanceof TicketError) &&
        !(error instanceof Error && ['NOTE_SPENT', 'NOTE_NOT_IN_TREE'].includes(error.message))
      )
        throw error;
      const code =
        error instanceof TicketError
          ? error.code
          : error instanceof Error && /^[A-Z_]+$/.test(error.message)
            ? error.message
            : 'RECEIVE_FAILED';
      runtime.state.errors.push({ code, commitment: memo.commitment });
    }
  }
  runtime.state.scanBlock = block.toString();
  await runtime.save();
}
