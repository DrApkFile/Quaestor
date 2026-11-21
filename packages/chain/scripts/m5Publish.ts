import { readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { hexToBytes, type Hex } from 'viem';
import { z } from 'zod';
import { artifactSchema, grantSchema, sealedRecordSchema, signLegacyMap, hashBytes } from '@quaestor/core';
import { m2Context, m2Root } from './m2Context.js';
import { readJson, signingKeys } from './m3Shared.js';
import { assertPublishable, publicRecordBytes, type BlobKind } from '../src/blobPayload.js';
import { postBlob } from '../src/blobs.js';
import { createGateway } from '../src/gateway.js';
import { loadPoolAbi } from '../src/abi.js';
import { writePrivateJson } from '../src/storage.js';
import { openWindow } from '../src/window.js';
import { resolveOperation } from '../src/executor.js';
import { paymentEvidence } from '../src/evidence.js';
import { readRegistry } from '../src/tickets/kemRegistry.js';
import { verifyCard, cardSchema } from '../src/tickets/cardCodec.js';
import { addressSchema, hexSchema } from '../src/config.js';
interface Payload {
  source: string;
  kind: BlobKind;
  bytes: Uint8Array;
  anchor: Hex | null;
}
export async function publishM5() {
  const output = `${m2Root}/evidence/m5-published.json`;
  if (existsSync(output)) return readJson(output);
  const deployment = z
    .object({ address: addressSchema, deployBlock: z.string() })
    .passthrough()
    .parse(readJson(`${m2Root}/evidence/m5-blob-deploy.json`));
  const previous = z
    .object({ contract: addressSchema, books: z.object({ honest: hexSchema, attack: hexSchema }).passthrough() })
    .passthrough()
    .parse(readJson(`${m2Root}/evidence/m4-verdicts.json`));
  const publisher = await m2Context('deployer', 'm5-publish');
  const owner = await m2Context('business', 'm5-publish');
  const payloads: Payload[] = [];
  const add = (source: string, kind: BlobKind, bytes: Uint8Array, anchor: Hex | null) => {
    assertPublishable(kind, bytes);
    payloads.push({ source, kind, bytes, anchor });
  };
  const source = `${m2Root}/.accounts/m4-live/ciphertexts`;
  for (const name of readdirSync(source)
    .filter((name) => name.endsWith('.json') && name !== 'manifest.json')
    .sort()) {
    const value = readJson(`${source}/${name}`);
    const entry = artifactSchema.safeParse(value);
    const grant = grantSchema.safeParse(value);
    if (entry.success) {
      add(name, 'entry', hexToBytes(entry.data.blob), entry.data.blobSha3);
      add(`${name}:signed-record`, 'entry', publicRecordBytes(entry.data), entry.data.blobSha3);
      continue;
    }
    if (grant.success) {
      add(name, 'grant', publicRecordBytes(grant.data), null);
      continue;
    }
    const record = sealedRecordSchema.parse(value);
    const kind = name.includes('-opening') ? 'opening' : name.includes('-close') ? 'close' : null;
    if (!kind) throw new Error('UNKNOWN_CIPHERTEXT_RECORD');
    const book = name.startsWith('honest-') ? previous.books.honest : previous.books.attack;
    const bytes = hexToBytes(record.blob);
    add(name, kind, bytes, record.sha3);
    const mapping = signLegacyMap(
      { book, kind, anchoredSha3: record.sha3, ciphertextSha3: hashBytes(bytes) },
      signingKeys(owner),
    );
    add(`${name}:legacy-map`, 'legacy-map', publicRecordBytes(mapping), record.sha3);
  }
  const at = await publisher.reader.getBlockNumber({ cacheTime: 0 });
  for (const name of readdirSync(`${m2Root}/cards`)
    .filter((name) => name.endsWith('.json'))
    .sort()) {
    const card = cardSchema.parse(readJson(`${m2Root}/cards/${name}`));
    const registry = await readRegistry(publisher.config, card.address, at);
    if (verifyCard(card, registry).kind !== 'VERIFIED') throw new Error('CARD_INVALID');
    add(`cards/${name}`, 'card', publicRecordBytes(card), null);
  }
  const gateway = createGateway(
    publisher.config,
    publisher.account,
    publisher.reader,
    publisher.poolAbi,
    deployment.address,
  );
  for (const operation of publisher.journal.read().operations)
    if (operation.stage === 'OUTCOME_UNKNOWN' || operation.stage === 'BROADCAST') {
      const settled = await resolveOperation(publisher.journal, operation.id, gateway);
      if (settled.kind !== 'LANDED') throw new Error(settled.kind);
    }
  const window = await openWindow(publisher.config, publisher.account, BigInt(payloads.length + 2), 5_000_000n);
  writePrivateJson(`${m2Root}/.accounts/m5-publish/window.json`, window.transaction);
  const rows = [];
  const abi = loadPoolAbi(`${m2Root}/contracts/out/BlobBoard.sol/BlobBoard.json`);
  for (const [index, payload] of payloads.entries()) {
    const sha3 = hashBytes(payload.bytes);
    console.log(
      `Blob ${String(index + 1)}/${String(payloads.length)} ${payload.kind} ${String(payload.bytes.length)} bytes`,
    );
    const result = await postBlob(
      publisher.journal,
      `m5-${payload.kind}-${sha3.slice(2)}`,
      deployment.address,
      payload.kind,
      payload.bytes,
      abi,
      gateway,
    );
    if (result.kind !== 'LANDED') throw new Error(result.kind);
    const transaction = paymentEvidence(result.operation);
    rows.push({
      source: payload.source,
      kind: payload.kind,
      sha3,
      bytes: payload.bytes.length,
      booksAnchor: payload.anchor,
      gasPerKB: (
        (BigInt(transaction.gasUsed) * 1000n + BigInt(payload.bytes.length) - 1n) /
        BigInt(payload.bytes.length)
      ).toString(),
      feePaidWei: (BigInt(transaction.gasUsed) * BigInt(transaction.effectiveGasPrice)).toString(),
      transaction,
    });
    writePrivateJson(`${m2Root}/.accounts/m5-publish/posted.json`, rows);
  }
  const result = {
    command: 'pnpm evidence --m5-publish (also used by --m5-blobs)',
    at: new Date().toISOString(),
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: m2Root, encoding: 'utf8' }).trim(),
    board: deployment.address,
    deployBlock: deployment.deployBlock,
    maximumBytes: 24576,
    KB: 1000,
    window: window.transaction,
    cardCount: rows.filter((row) => row.kind === 'card').length,
    posted: rows,
    excluded: [
      {
        source: 'manifest.json',
        reason: 'unsigned local aggregate; its ciphertext constituents are posted individually',
      },
    ],
  };
  writePrivateJson(output, result);
  return result;
}
