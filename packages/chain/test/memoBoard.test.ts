import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateSealKeys, recipientOf, seal } from '@qorechain/qoreseal';
import { parseAbi } from 'viem';
import { expect, it } from 'vitest';
import { Journal } from '../src/journal.js';
import { postTicket } from '../src/tickets/memoBoard.js';
import { executeOperation } from '../src/executor.js';
import { fakeGateway, prepared, output, note, request } from './fixtures.js';

const fakeBoardAbi = parseAbi(['function postMemo(bytes32 paymentCommitment, bytes memo)']);
function opaqueTicket() {
  return seal({ chainId: 'qorechain-diana', purpose: 'quaestor:ticket', mode: 'hybrid', anonymous: true,
    recipients: [recipientOf(generateSealKeys()), recipientOf(generateSealKeys())], plaintext: new Uint8Array() });
}
it('T-JOURNAL advances LANDED to TICKET_POSTED only after the memo receipt and never resends the payment', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'quaestor-memo-'));
  try {
    const journal = new Journal(join(directory, 'business.json'), 'business');
    journal.save({ v: 1, operations: [], notes: [note] });
    const gateway = fakeGateway();
    const payment = request();
    expect((await executeOperation(journal, payment, gateway)).kind).toBe('LANDED');
    const ticket = opaqueTicket();
    expect((await postTicket(journal, payment.id, output.commitment, ticket, fakeBoardAbi, gateway)).kind).toBe('LANDED');
    expect(journal.read().operations[0]).toMatchObject({ stage: 'TICKET_POSTED', ticket: { commitment: output.commitment } });
    expect((await executeOperation(journal, payment, gateway)).kind).toBe('LANDED');
    await postTicket(journal, payment.id, output.commitment, ticket, fakeBoardAbi, gateway);
    expect(gateway.broadcast).toHaveBeenCalledTimes(2);
    expect(journal.read().notes.every(item => item.owner === 'business')).toBe(true);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
it('T-JOURNAL keeps a payment LANDED if posting its ticket reverts', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'quaestor-memo-revert-'));
  try {
    const journal = new Journal(join(directory, 'business.json'), 'business');
    journal.save({ v: 1, operations: [], notes: [note] });
    const gateway = fakeGateway();
    await executeOperation(journal, request(), gateway);
    gateway.receipt.mockResolvedValue({ hash: `0x${'ab'.repeat(32)}`, blockNumber: '10', blockHash: `0x${'ab'.repeat(32)}`,
      gasUsed: '20', effectiveGasPrice: '30', status: 'reverted' });
    expect(await postTicket(journal, 'send', prepared.outputs[0]!.commitment, opaqueTicket(), fakeBoardAbi, gateway))
      .toEqual({ kind: 'TRANSACTION_REVERTED' });
    expect(journal.read().operations[0]?.stage).toBe('LANDED');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
