import { parseAbi, decodeEventLog, zeroAddress, type Address, type Hex, type PublicClient } from 'viem';
import { z } from 'zod';
import { hex32 } from '@quaestor/core';
import { addressSchema } from './config.js';
export const booksReadAbi = parseAbi([
  'function books(bytes32) view returns (address)',
  'function openings(bytes32) view returns (bytes32)',
  'function periods(bytes32,bytes32) view returns (uint64,bytes32,bool,bytes32)',
  'event BookRegistered(bytes32 indexed book,address indexed owner)',
  'event OpeningAnchored(bytes32 indexed book,bytes32 openingSha3)',
  'event EntryAnchored(bytes32 indexed book,bytes32 indexed period,uint64 index,bytes32 blobSha3,bytes32 prevSha3)',
  'event GrantAnchored(bytes32 indexed book,bytes32 indexed period,address indexed auditor,bytes32 grantSha3)',
  'event PeriodClosedEvent(bytes32 indexed book,bytes32 indexed period,bytes32 closeSha3)',
]);
export interface BooksConfig {
  address: Address;
  deployBlock: bigint;
  chunkSize: bigint;
}
export interface EntryRow {
  period: Hex;
  index: number;
  blobSha3: Hex;
  prevSha3: Hex;
  block: bigint;
  transactionHash: Hex;
}
export interface GrantRow {
  period: Hex;
  auditor: Address;
  sha3: Hex;
  block: bigint;
  transactionHash: Hex;
}
export interface PeriodRow {
  id: Hex;
  count: number;
  lastSha3: Hex;
  closed: boolean;
  closeSha3: Hex;
  closeBlock: bigint | null;
}
export interface BookSnapshot {
  book: Hex;
  owner: Address;
  openingSha3: Hex;
  block: bigint;
  entries: EntryRow[];
  grants: GrantRow[];
  periods: PeriodRow[];
}
export async function readBook(
  client: PublicClient,
  config: BooksConfig,
  book: Hex,
  at?: bigint,
): Promise<BookSnapshot> {
  book = hex32.parse(book.toLowerCase());
  const block = at ?? (await client.getBlockNumber({ cacheTime: 0 }));
  const owner = addressSchema.parse(
    await client.readContract({
      address: config.address,
      abi: booksReadAbi,
      functionName: 'books',
      args: [book],
      blockNumber: block,
    }),
  );
  if (owner === zeroAddress) throw new Error('BOOK_UNAVAILABLE');
  const openingSha3 = hex32.parse(
    await client.readContract({
      address: config.address,
      abi: booksReadAbi,
      functionName: 'openings',
      args: [book],
      blockNumber: block,
    }),
  );
  const entries: EntryRow[] = [];
  const grants: GrantRow[] = [];
  const closed = new Map<Hex, bigint>();
  for (let from = config.deployBlock; from <= block; from += config.chunkSize) {
    const end = from + config.chunkSize - 1n;
    const logs = await client.getLogs({ address: config.address, fromBlock: from, toBlock: end > block ? block : end });
    for (const log of logs) {
      if (log.removed || log.blockNumber < from || log.blockNumber > block) throw new Error('BOOK_LOG_INVALID');
      const decoded = decodeEventLog({ abi: booksReadAbi, data: log.data, topics: log.topics, strict: true });
      const raw = z.object({ book: hex32 }).passthrough().parse(decoded.args);
      if (raw.book.toLowerCase() !== book.toLowerCase()) continue;
      if (decoded.eventName === 'EntryAnchored') {
        const args = z
          .object({ book: hex32, period: hex32, index: z.bigint().nonnegative(), blobSha3: hex32, prevSha3: hex32 })
          .strict()
          .parse(decoded.args);
        const index = Number(args.index);
        if (!Number.isSafeInteger(index)) throw new Error('BOOK_INDEX_INVALID');
        entries.push({
          period: args.period,
          index,
          blobSha3: args.blobSha3,
          prevSha3: args.prevSha3,
          block: log.blockNumber,
          transactionHash: log.transactionHash,
        });
      }
      if (decoded.eventName === 'GrantAnchored') {
        const args = z
          .object({ book: hex32, period: hex32, auditor: addressSchema, grantSha3: hex32 })
          .strict()
          .parse(decoded.args);
        grants.push({
          period: args.period,
          auditor: args.auditor,
          sha3: args.grantSha3,
          block: log.blockNumber,
          transactionHash: log.transactionHash,
        });
      }
      if (decoded.eventName === 'PeriodClosedEvent') {
        const args = z.object({ book: hex32, period: hex32, closeSha3: hex32 }).strict().parse(decoded.args);
        closed.set(args.period, log.blockNumber);
      }
    }
  }
  const ids = [...new Set([...entries.map((e) => e.period), ...grants.map((g) => g.period), ...closed.keys()])];
  const periods: PeriodRow[] = [];
  for (const id of ids) {
    const state = z.tuple([z.bigint(), hex32, z.boolean(), hex32]).parse(
      await client.readContract({
        address: config.address,
        abi: booksReadAbi,
        functionName: 'periods',
        args: [book, id],
        blockNumber: block,
      }),
    );
    const count = Number(state[0]);
    if (!Number.isSafeInteger(count)) throw new Error('BOOK_COUNT_INVALID');
    periods.push({
      id,
      count,
      lastSha3: state[1],
      closed: state[2],
      closeSha3: state[3],
      closeBlock: closed.get(id) ?? null,
    });
  }
  entries.sort((a, b) => a.period.localeCompare(b.period) || a.index - b.index);
  return { book, owner, openingSha3, block, entries, grants, periods };
}
