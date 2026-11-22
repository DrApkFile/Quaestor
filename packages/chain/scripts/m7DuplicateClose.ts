import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { pqcSign } from '@qorechain/sdk';
import { hexToBytes, toHex, zeroAddress, type Abi, type Hex } from 'viem';
import {
  closeRecord,
  closeDigestV2,
  grantPeriod,
  hashRecord,
  contractPeriod,
  holdingsCloseSchema,
  selectHoldingsNotes,
  sealRecord,
  sealedRecordSchema,
  grantSchema,
  type EntryArtifact,
  type EpochKey,
} from '@quaestor/core';
import { readRegistry } from '../src/tickets/kemRegistry.js';
import { verifyCard, cardSchema } from '../src/tickets/cardCodec.js';
import { publicRecordBytes, type BlobKind } from '../src/blobPayload.js';
import type { StoredNote } from '../src/journalSchema.js';
import type { paymentEvidence } from '../src/evidence.js';
import { proveFundsM7 } from './m7DuplicateProof.js';
import { m2Root, type M2Context } from './m2Context.js';
import { readJson, artifact, signingKeys, sendCall } from './m3Shared.js';
export async function closeDuplicate(
  owner: M2Context,
  auditor: M2Context,
  dir: string,
  job: { book: Hex; period: string },
  epoch: EpochKey,
  entries: EntryArtifact[],
  previous: Hex,
  notes: StoredNote[],
  openingSha3: Hex,
  booksAddress: Hex,
  booksAbi: Abi,
  post: (id: string, kind: BlobKind, bytes: Uint8Array) => Promise<void>,
) {
  const signing = signingKeys(owner),
    txs: ReturnType<typeof paymentEvidence>[] = [];
  const selected = selectHoldingsNotes(notes, 2000000000000000000n);
  if (selected.kind !== 'SELECTED') throw new Error(selected.kind);
  const close = artifact(`${dir}/close.json`, holdingsCloseSchema, () => ({
    ...closeRecord(job.book, job.period, entries, 2),
    priorSha3: openingSha3,
    openingBalance: { [zeroAddress]: '0' },
    closingBalance: { [zeroAddress]: '2000000000000000000' },
    cashOutFees: {},
    holdings: {},
  }));
  if (!close.holdings[zeroAddress]) {
    close.holdings[zeroAddress] = await proveFundsM7(owner, selected.notes, job.book, job.period);
    writeFileSync(`${dir}/close.json`, JSON.stringify(close), { mode: 0o600 });
  }
  const sealedClose = artifact(`${dir}/sealed-close.json`, sealedRecordSchema, () =>
    sealRecord(close, epoch, signing, `quaestor:${job.book}:close`),
  );
  await post('m7-dup-close-blob', 'close', hexToBytes(sealedClose.blob));
  const signature = artifact(
    `${dir}/signature.json`,
    z.object({ hex: z.string().transform((v) => v as `0x${string}`) }),
    () => ({
      hex: toHex(
        pqcSign(
          owner.account.pqc.secretKey,
          hexToBytes(closeDigestV2(job.book, job.period, 2, previous, sealedClose.sha3, 9800n, booksAddress)),
        ),
      ),
    }),
  );
  txs.push(
    await sendCall(owner, booksAddress, booksAbi, 'm7-dup-close', 'closePeriod', [
      job.book,
      contractPeriod(job.period),
      2n,
      previous,
      sealedClose.sha3,
      signature.hex,
    ]),
  );
  const block = await owner.reader.getBlockNumber({ cacheTime: 0 }),
    registry = await readRegistry(owner.config, auditor.account.cosmos, block);
  const verified = verifyCard(cardSchema.parse(readJson(`${m2Root}/cards/${auditor.account.cosmos}.json`)), registry);
  if (verified.kind !== 'VERIFIED') throw new Error('CARD_INVALID');
  const grant = artifact(`${dir}/grant.json`, grantSchema, () =>
    grantPeriod(
      job.book,
      job.period,
      auditor.account.cosmos,
      epoch,
      verified.recipient,
      new Date().toISOString(),
      signing,
    ),
  );
  await post('m7-dup-grant-blob', 'grant', publicRecordBytes(grant));
  txs.push(
    await sendCall(owner, booksAddress, booksAbi, 'm7-dup-grant', 'anchorGrant', [
      job.book,
      contractPeriod(job.period),
      auditor.account.evm,
      hashRecord(grant),
    ]),
  );
  return txs;
}
