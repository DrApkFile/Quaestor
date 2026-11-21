import type { Address } from 'viem';
import type { contextsM4 } from './m4State.js';
import type { setupBooksM4 } from './m4BookSetup.js';
type Contexts = Awaited<ReturnType<typeof contextsM4>>;
type Setup = Awaited<ReturnType<typeof setupBooksM4>>;
import { zeroAddress, type Hex } from 'viem';
import {
  openingSchema,
  contractPeriod,
  hashRecord,
  closeRecord,
  holdingsCloseSchema,
  closingBalances,
  decryptEntry,
  type EntryArtifact,
} from '@quaestor/core';
import { openingNotes, windowM4 } from './m4State.js';
import { clientInput, payM4 } from './m4Pay.js';
import { entryM4, fundsM4, recordM4, closeM4 } from './m4Records.js';
import { sendCall } from './m3Shared.js';
import { loadPoolAbi } from '../src/abi.js';
import { m2Root } from './m2Context.js';
import { bookPayment, anchorPayment } from '../src/books.js';
export async function runHonestM4(contexts: Contexts, setup: Setup, contract: Address) {
  const { business, client, supplier1, supplier2, auditor } = contexts;
  const { plan, honest } = setup;
  const opening = await openingNotes(business);
  const starting = { [zeroAddress]: opening.reduce((sum, n) => sum + BigInt(n.amountWei), 0n).toString() };
  const openingRecord = openingSchema.parse({ v: 1, book: honest.book, openingBalance: starting, at: plan.issuedAt });
  const openingCipher = recordM4(business, openingRecord, honest.key, 'honest-opening', honest.book);
  const abi = loadPoolAbi(`${m2Root}/contracts/out/Books.sol/Books.json`);
  const call = (id: string, name: string, args: readonly unknown[]) =>
    sendCall(business, contract, abi, id, name, args);
  await windowM4(business, 26n, 1_500_000n);
  await windowM4(client, 3n, 3_000_000n);
  const registered = await call('m4-honest-register', 'registerBook', [plan.salt, openingCipher.sha3]);
  console.log('M4: three new anonymous payments in A');
  const shield = await clientInput(client);
  const incoming = await payM4(client, business, 'm4-in', shield.note, 1_000_000_000_000_000_000n);
  const first = await payM4(business, supplier1, 'm4-out1', incoming.note, 500_000_000_000_000_000n);
  const second = await payM4(business, supplier2, 'm4-out2', first.change, 250_000_000_000_000_000n);
  const zero: Hex = `0x${'00'.repeat(32)}`;
  const e0 = await entryM4(
    business,
    incoming.note,
    honest.book,
    plan.a,
    0,
    zero,
    'IN',
    client.account.cosmos,
    honest.key,
    'honest',
  );
  const e1 = await entryM4(
    business,
    first.note,
    honest.book,
    plan.a,
    1,
    e0.blobSha3,
    'OUT',
    supplier1.account.cosmos,
    honest.key,
    'honest',
  );
  const e2 = await entryM4(
    business,
    second.note,
    honest.book,
    plan.a,
    2,
    e1.blobSha3,
    'OUT',
    supplier2.account.cosmos,
    honest.key,
    'honest',
  );
  const entries = [e0, e1, e2];
  const operations = [
    { journal: client.journal, id: 'm4-in' },
    { journal: business.journal, id: 'm4-out1' },
    { journal: business.journal, id: 'm4-out2' },
  ];
  const anchor = async (entry: EntryArtifact, id: string) =>
    call(id, 'anchorEntry', [
      entry.book,
      contractPeriod(entry.period),
      entry.index,
      entry.blobSha3,
      entry.prevEntrySha3,
    ]);
  const anchors: Awaited<ReturnType<typeof sendCall>>[] = [];
  for (const [index, entry] of entries.entries()) {
    const op = operations[index];
    if (!op) throw new Error('OPERATION_REQUIRED');
    await bookPayment(op.journal, op.id, entry);
    const landed = await anchor(entry, `m4-honest-a-${String(index)}`);
    anchors.push(landed);
    await anchorPayment(op.journal, op.id, entry.blobSha3, landed);
  }
  console.log('M4: holdings proof, close A, grants');
  const plain = entries.map((e) => decryptEntry(e, honest.key));
  const closing = closingBalances(starting, plain, {});
  const proof = await fundsM4(business, [...opening, second.change], closing, honest.book, plan.a, 'honest');
  if (proof.kind !== 'PROVED') throw new Error(proof.code);
  const close = holdingsCloseSchema.parse({
    ...closeRecord(honest.book, plan.a, entries, anchors.length),
    priorSha3: openingCipher.sha3,
    closingBalance: closing,
    cashOutFees: {},
    holdings: { [zeroAddress]: proof.proof },
  });
  const closeCipher = recordM4(business, close, honest.key, 'honest-close', honest.book);
  const closeTx = await closeM4(business, contract, close, 'm4-honest-close');
  const grantTx = await call('m4-honest-grant', 'anchorGrant', [
    honest.book,
    contractPeriod(plan.a),
    auditor.account.evm,
    hashRecord(honest.grant),
  ]);
  const ownerATx = await call('m4-honest-self-a', 'anchorGrant', [
    honest.book,
    contractPeriod(plan.a),
    business.account.evm,
    hashRecord(honest.own),
  ]);
  const ownerBTx = await call('m4-honest-self-b', 'anchorGrant', [
    honest.book,
    contractPeriod(plan.b),
    business.account.evm,
    hashRecord(honest.selfB),
  ]);
  console.log('M4: payment in open B spends an A backing note after its close');
  await windowM4(business, 12n, 1_500_000n);
  const later = await payM4(business, supplier1, 'm4-b-out', second.change, 125_000_000_000_000_000n);
  const entryB = await entryM4(
    business,
    later.note,
    honest.book,
    plan.b,
    0,
    zero,
    'OUT',
    supplier1.account.cosmos,
    honest.keyB,
    'honest',
  );
  await bookPayment(business.journal, 'm4-b-out', entryB);
  const anchorB = await anchor(entryB, 'm4-honest-b-0');
  await anchorPayment(business.journal, 'm4-b-out', entryB.blobSha3, anchorB);

  return {
    opening,
    starting,
    openingCipher,
    call,
    anchor,
    registered,
    shield,
    incoming,
    first,
    second,
    entries,
    e0,
    plain,
    anchors,
    close,
    closeCipher,
    closeTx,
    grantTx,
    ownerATx,
    ownerBTx,
    later,
    entryB,
    anchorB,
    zero,
  };
}
