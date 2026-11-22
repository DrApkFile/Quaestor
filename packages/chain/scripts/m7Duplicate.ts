import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { hexToBytes, toHex, keccak256, encodePacked, zeroAddress } from 'viem';
import {
  sealEntry,
  sealRecord,
  sealedRecordSchema,
  artifactSchema,
  contractPeriod,
  verifyProof,
  decryptEntry,
  receiptContext,
  hex32,
} from '@quaestor/core';
import { m2Context, m2Root } from './m2Context.js';
import { readJson, artifact, signingKeys, sendCall } from './m3Shared.js';
import { receiptProof } from './m3Receipt.js';
import { loadPoolAbi } from '../src/abi.js';
import { createGateway } from '../src/gateway.js';
import { postBlob } from '../src/blobs.js';
import { publicRecordBytes, type BlobKind } from '../src/blobPayload.js';
import { paymentEvidence } from '../src/evidence.js';
import { deploymentSchema } from '../src/readerConfig.js';
import { windowM7 } from './m7DuplicateProof.js';
import { duplicateSource } from './m7DuplicateSource.js';
import { closeDuplicate } from './m7DuplicateClose.js';
export async function duplicateM7() {
  const output = `${m2Root}/evidence/m7-duplicate.json`;
  if (existsSync(output)) return;
  const owner = await m2Context('business', 'm7-duplicate'),
    auditor = await m2Context('auditor', 'm7-duplicate');
  const dir = `${m2Root}/.accounts/m7-duplicate`;
  const deploy = deploymentSchema.parse(readJson(`${m2Root}/config/m5.json`));
  const { payment, sourceBook, notes, period } = await duplicateSource(owner);
  const job = artifact(
    `${dir}/job.json`,
    z
      .object({
        salt: hex32,
        book: hex32,
        key: hex32,
        period: z.string(),
      })
      .strict(),
    () => {
      const salt = toHex(randomBytes(32));
      return {
        salt,
        book: keccak256(encodePacked(['address', 'bytes32'], [owner.account.evm as `0x${string}`, salt])),
        key: toHex(randomBytes(32)),
        period,
      };
    },
  );
  const epoch = { epoch: 1n, key: hexToBytes(job.key) },
    signing = signingKeys(owner);
  const opening = artifact(`${dir}/opening.json`, sealedRecordSchema, () =>
    sealRecord(
      {
        v: 1,
        book: job.book,
        openingBalance: { [zeroAddress]: '0' },
        periodLength: 'Daily (demo-scale)',
        at: new Date().toISOString(),
      },
      epoch,
      signing,
      `quaestor:${job.book}:opening`,
    ),
  );
  const booksAbi = loadPoolAbi(`${m2Root}/contracts/out/Books.sol/Books.json`),
    boardAbi = loadPoolAbi(`${m2Root}/contracts/out/BlobBoard.sol/BlobBoard.json`);
  const txs: ReturnType<typeof paymentEvidence>[] = [];
  const post = async (id: string, kind: BlobKind, bytes: Uint8Array) => {
    const result = await postBlob(
      owner.journal,
      id,
      deploy.board.address,
      kind,
      bytes,
      boardAbi,
      createGateway(owner.config, owner.account, owner.reader, owner.poolAbi, deploy.board.address),
    );
    if (result.kind !== 'LANDED') throw new Error(result.kind);
    txs.push(paymentEvidence(result.operation));
  };
  const native = await windowM7(owner, dir);
  await post('m7-dup-opening', 'opening', hexToBytes(opening.blob));
  txs.push(
    await sendCall(owner, deploy.books.address, booksAbi, 'm7-dup-register', 'registerBook', [job.salt, opening.sha3]),
  );
  const entries = [];
  const receipts = [];
  let previous: `0x${string}` = `0x${'00'.repeat(32)}`;
  for (const index of [0, 1]) {
    const path = `${dir}/entry-${String(index)}.json`;
    let sealed;
    if (existsSync(path)) sealed = artifactSchema.parse(readJson(path));
    else {
      const receipt = await receiptProof(owner, payment.note, job.book, job.period, index);
      if (!(await verifyProof(readJson(`${m2Root}/apps/web/public/circuits/receipt_vkey.json`), receipt)))
        throw new Error('BAD_PROOF');
      sealed = sealEntry(
        {
          v: 1,
          book: job.book,
          period: job.period,
          index,
          prevEntrySha3: previous,
          direction: 'IN',
          asset: payment.note.asset,
          amount: payment.note.amountWei,
          paymentCommitment: payment.note.commitment,
          counterparty: { address: payment.counterparty, name: 'Client (demo)' },
          purpose: 'Duplicate payment attack (demo)',
          category: 'attack lab',
          notes: 'Same real payment, fresh bound receipt',
          receipt,
        },
        epoch,
        signing,
        owner.config.pool,
      );
      writeFileSync(path, JSON.stringify(sealed), { mode: 0o600 });
    }
    const receipt = decryptEntry(sealed, epoch).receipt;
    if (
      receipt.publicSignals[6] !== receiptContext(job.book, job.period, index, owner.config.pool).toString() ||
      !(await verifyProof(readJson(`${m2Root}/apps/web/public/circuits/receipt_vkey.json`), receipt))
    )
      throw new Error('RECEIPT_CONTEXT_OR_PROOF_FAILED');
    receipts.push(receipt);
    await post(`m7-dup-entry-${String(index)}-blob`, 'entry', hexToBytes(sealed.blob));
    await post(`m7-dup-entry-${String(index)}-signature`, 'entry', publicRecordBytes(sealed));
    txs.push(
      await sendCall(owner, deploy.books.address, booksAbi, `m7-dup-entry-${String(index)}-anchor`, 'anchorEntry', [
        job.book,
        contractPeriod(job.period),
        BigInt(index),
        sealed.blobSha3,
        previous,
      ]),
    );
    entries.push(sealed);
    previous = sealed.blobSha3;
  }
  if (JSON.stringify(receipts[0]?.proof) === JSON.stringify(receipts[1]?.proof))
    throw new Error('FRESH_RECEIPTS_REQUIRED');
  txs.push(
    ...(await closeDuplicate(
      owner,
      auditor,
      dir,
      job,
      epoch,
      entries,
      previous,
      notes,
      opening.sha3,
      deploy.books.address,
      booksAbi,
      post,
    )),
  );
  writeFileSync(
    output,
    JSON.stringify(
      {
        command: 'pnpm evidence --m7',
        label: 'attack lab (demo)',
        bookId: job.book,
        sourcePaymentCommitment: payment.note.commitment,
        freshReceiptContexts: receipts.map((receipt) => receipt.publicSignals[6]),
        bothFreshReceiptsVerified: true,
        entries: entries.map((entry) => ({ index: entry.index, blobSha3: entry.blobSha3 })),
        native,
        transactions: txs,
      },
      null,
      2,
    ) + '\n',
  );
  const metadata = JSON.stringify({ honest: sourceBook, duplicate: job.book, label: 'Northwind Studio (demo)' });
  writeFileSync(`${m2Root}/apps/web/public/m7-demo.json`, metadata);
  writeFileSync(`${m2Root}/apps/web/dist/m7-demo.json`, metadata);
}
