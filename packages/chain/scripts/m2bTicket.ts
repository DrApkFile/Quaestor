import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { hexToBytes, toHex } from 'viem';
import { m2Context, m2Root } from './m2Context.js';
import { Journal } from '../src/journal.js';
import { openWindow } from '../src/window.js';
import { resolveCard } from '../src/tickets/card.js';
import { sealTicket, ticketMetadata } from '../src/tickets/ticket.js';
import { postTicket } from '../src/tickets/memoBoard.js';
import { createGateway } from '../src/gateway.js';
import { paymentEvidence } from '../src/evidence.js';
import { launchM2Worker } from './m2Child.js';
import { writePrivateJson } from '../src/storage.js';
import { parseEnvelope, recipientHint } from '@qorechain/qoreseal';
import { readRegistry } from '../src/tickets/kemRegistry.js';
const path = `${m2Root}/evidence/m2b-ticket-anonymous.json`;
if (existsSync(path)) throw new Error('ANONYMOUS_RUN_ALREADY_EXISTS');
const business = await m2Context('business', 'm2b');
const supplier = await m2Context('supplier1', 'm2b');
const source = new Journal(`${m2Root}/.accounts/m2/business.json`, 'business');
const note = source.read().notes.find((note) => note.state === 'OWNED' && note.amountWei === '1000000000000000000');
if (!note) throw new Error('CHANGE_NOTE_REQUIRED');
const block = await business.reader.getBlockNumber({ cacheTime: 0 });
const recipients = await Promise.all([
  resolveCard(business.config, `${m2Root}/cards/${supplier.account.cosmos}.json`, supplier.account.cosmos, block),
  resolveCard(business.config, `${m2Root}/cards/${business.account.cosmos}.json`, business.account.cosmos, block),
]);
const [payee, payer] = recipients;
if (payee.kind !== 'VERIFIED' || payer.kind !== 'VERIFIED') throw new Error('CARD_INVALID');
await source.exclusive(() => {
  return Promise.resolve().then(() => {
    const data = source.read();
    const current = data.notes.find((item) => item.commitment === note.commitment);
    if (current?.state !== 'OWNED') throw new Error('NOTE_SPENT');
    current.state = 'SPENDING';
    source.save(data);
    business.journal.save({ v: 1, operations: [], notes: [note] });
  });
});
const window = await openWindow(business.config, business.account, 2n, 1500000n);
const send = await business.pool.privateSend('m2b-send', note.commitment, 1000000000000000000n, 'supplier1');
if (send.kind !== 'LANDED' || !send.operation.prepared) throw new Error(send.kind);
await source.exclusive(() => {
  return Promise.resolve().then(() => {
    const data = source.read();
    const current = data.notes.find((item) => item.commitment === note.commitment);
    if (!current) throw new Error('NOTE_REQUIRED');
    current.state = 'SPENT';
    source.save(data);
  });
});
const payment = send.operation.prepared.outputs.find((output) => output.owner === 'supplier1');
if (!payment) throw new Error('PAYMENT_NOTE_REQUIRED');
const envelope = await sealTicket(
  {
    v: 1,
    secret: payment.secret,
    commitment: payment.commitment,
    nullifier: payment.nullifier,
    amountWei: payment.amountWei,
    asset: payment.asset,
    pool: business.config.pool,
    chainId: 9800,
  },
  [payee, payer],
);
writePrivateJson(`${m2Root}/.accounts/m2b/ticket.json`, { ciphertext: toHex(envelope) });
const posted = await postTicket(
  business.journal,
  'm2b-send',
  payment.commitment,
  envelope,
  business.memoAbi,
  createGateway(business.config, business.account, business.reader, business.poolAbi, business.board.address),
);
if (posted.kind !== 'LANDED' || !posted.operation.hash) throw new Error(posted.kind);
const received = await launchM2Worker('supplier1', payment.commitment, posted.operation.hash, 'm2b');
const outsider = await launchM2Worker('client', payment.commitment, posted.operation.hash, 'm2b');
const parsed = parseEnvelope(envelope);
const at = await business.reader.getBlockNumber({ cacheTime: 0 });
const publicKeys = await Promise.all(
  ['business', 'supplier1', 'auditor', 'client'].map(async (role) => {
    const context = await m2Context(role as 'business' | 'supplier1' | 'auditor' | 'client', 'm2b');
    return (await readRegistry(context.config, context.account.cosmos, at)).mlkemPublicKey;
  }),
);
const hintsUnlinkable = parsed.entries.every(
  (entry) =>
    entry.hint.every((byte) => byte === 0) &&
    publicKeys.every((key) => !Buffer.from(entry.hint).equals(Buffer.from(recipientHint(parsed.salt, key)))),
);
if (!hintsUnlinkable || outsider.openCode !== 'DECRYPTION_FAILED' || !received.balanceMatched)
  throw new Error('ANONYMOUS_RUN_FAILED');
const evidence = {
  command: 'pnpm evidence --m2',
  label: 'm2b-ticket-anonymous',
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: m2Root, encoding: 'utf8' }).trim(),
  at: new Date().toISOString(),
  demo: true,
  status: 'PASSED',
  anonymous: parsed.anonymous,
  ticket: ticketMetadata(hexToBytes(toHex(envelope))),
  registeredKeyCount: publicKeys.length,
  hintsUnlinkable,
  window: window.transaction,
  payment: paymentEvidence(send.operation),
  memo: paymentEvidence(posted.operation),
  supplier: received,
  client: outsider,
};
writePrivateJson(path, evidence);
console.log(JSON.stringify(evidence, null, 2));
