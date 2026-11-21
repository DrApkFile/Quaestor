import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';
import { hexToBytes, toHex } from 'viem';
import { createGateway } from '../src/gateway.js';
import { paymentEvidence } from '../src/evidence.js';
import { resolveCard } from '../src/tickets/card.js';
import { postTicket } from '../src/tickets/memoBoard.js';
import { sealTicket, ticketMetadata } from '../src/tickets/ticket.js';
import { hexSchema } from '../src/config.js';
import { checkWindow, openWindow } from '../src/window.js';
import { writePrivateJson } from '../src/storage.js';
import { importM1Change, finishM1Import } from './m2Import.js';
import { m2Root, type M2Context } from './m2Context.js';
import { sha3, type M2Evidence } from './m2Evidence.js';
export async function payM2(context: M2Context, payeeAddress: string, evidence: M2Evidence, save: () => void) {
  const { config, account, reader, journal, pool } = context;
  const beforePayment = await reader.getBlockNumber({ cacheTime: 0 });
  const preflight = await Promise.all([
    resolveCard(config, `${m2Root}/cards/${payeeAddress}.json`, payeeAddress, beforePayment),
    resolveCard(config, `${m2Root}/cards/${account.cosmos}.json`, account.cosmos, beforePayment),
  ]);
  if (preflight.some((card) => card.kind !== 'VERIFIED')) throw new Error('CARD_INVALID');
  evidence.importedCommitment = await importM1Change(context);
  save();
  const held = journal
    .read()
    .operations.find(
      (operation) =>
        operation.id === 'm2-send' && (operation.stage === 'BROADCAST' || operation.stage === 'OUTCOME_UNKNOWN'),
    );
  if (held) {
    const outcome = await pool.resolve(held.id);
    if (outcome.kind !== 'LANDED') throw new Error(outcome.kind);
  }
  const existing = journal.read().operations.find((operation) => operation.id === 'm2-send');
  if (existing?.stage !== 'LANDED' && existing?.stage !== 'TICKET_POSTED') {
    const window = await openWindow(config, account, 2n, 1500000n);
    evidence.nativeTransactions.push({ role: 'business', action: 'open-window', ...window.transaction });
    save();
    if (window.status.kind !== 'OPEN') throw new Error('WINDOW_CLOSED');
  }
  const outcome = await pool.privateSend('m2-send', evidence.importedCommitment, 2000000000000000000n, 'supplier1');
  if (outcome.kind !== 'LANDED' || !outcome.operation.prepared) throw new Error(outcome.kind);
  evidence.payment = paymentEvidence(outcome.operation);
  save();
  await finishM1Import(context, evidence.importedCommitment);
  const payment = outcome.operation.prepared.outputs.find((note) => note.owner === 'supplier1');
  if (!payment) throw new Error('PAYMENT_NOTE_REQUIRED');
  const ticketPath = `${m2Root}/.accounts/m2/pending-ticket.json`;
  let envelope: Uint8Array;
  let registryBlock: bigint;
  if (existsSync(ticketPath)) {
    const raw: unknown = JSON.parse(readFileSync(ticketPath, 'utf8'));
    const saved = z
      .object({ ciphertext: hexSchema, commitment: hexSchema, registryBlock: z.string().regex(/^\d+$/) })
      .strict()
      .parse(raw);
    if (saved.commitment !== payment.commitment) throw new Error('TICKET_INVALID');
    envelope = hexToBytes(saved.ciphertext);
    registryBlock = BigInt(saved.registryBlock);
  } else {
    registryBlock = await reader.getBlockNumber({ cacheTime: 0 });
    const [payee, payer] = await Promise.all([
      resolveCard(config, `${m2Root}/cards/${payeeAddress}.json`, payeeAddress, registryBlock),
      resolveCard(config, `${m2Root}/cards/${account.cosmos}.json`, account.cosmos, registryBlock),
    ]);
    if (payee.kind !== 'VERIFIED' || payer.kind !== 'VERIFIED') throw new Error('CARD_INVALID');
    envelope = await sealTicket(
      {
        v: 1,
        secret: payment.secret,
        commitment: payment.commitment,
        nullifier: payment.nullifier,
        amountWei: payment.amountWei,
        asset: payment.asset,
        pool: config.pool,
        chainId: 9800,
      },
      [payee, payer],
    );
    writePrivateJson(ticketPath, {
      ciphertext: toHex(envelope),
      commitment: payment.commitment,
      registryBlock: registryBlock.toString(),
    });
  }
  const metadata = ticketMetadata(envelope);
  evidence.ticket = {
    bytes: metadata.bytes,
    mode: 'hybrid',
    recipientCount: 2,
    sha3: sha3(envelope),
    commitment: payment.commitment,
    registryBlock: registryBlock.toString(),
  };
  save();
  const memoHeld = journal
    .read()
    .operations.find(
      (operation) =>
        operation.id === 'm2-send-memo' && (operation.stage === 'BROADCAST' || operation.stage === 'OUTCOME_UNKNOWN'),
    );
  const memoGateway = createGateway(config, account, reader, context.poolAbi, context.board.address);
  if (memoHeld) {
    const resolved = await pool.resolve(memoHeld.id);
    if (resolved.kind !== 'LANDED') throw new Error(resolved.kind);
  }
  const storedMemo = journal.read().operations.find((operation) => operation.id === 'm2-send-memo');
  if (storedMemo?.stage !== 'LANDED') {
    const window = await checkWindow(config, account.cosmos);
    if (window.kind !== 'OPEN') {
      const opened = await openWindow(config, account, 1n, 750000n);
      evidence.nativeTransactions.push({ role: 'business', action: 'open-window', ...opened.transaction });
      save();
      if (opened.status.kind !== 'OPEN') throw new Error('WINDOW_CLOSED');
    }
  }
  const memo = await postTicket(journal, 'm2-send', payment.commitment, envelope, context.memoAbi, memoGateway);
  if (memo.kind !== 'LANDED') throw new Error(memo.kind);
  evidence.memo = paymentEvidence(memo.operation);
  save();
}
