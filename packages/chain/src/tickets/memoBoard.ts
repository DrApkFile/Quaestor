import { decodeEventLog, encodeFunctionData, hexToBytes, toHex, type Abi, type Address, type Hex, type PublicClient } from 'viem';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { executeOperation, type Gateway } from '../executor.js';
import { Journal } from '../journal.js';
import { hexSchema } from '../config.js';
import { ticketMetadata } from './ticket.js';
import type { Memo } from './receive.js';
export interface BoardConfig {
    address: Address;
    deployBlock: bigint;
    chunkSize: bigint;
}
const memoArgs = z.object({ paymentCommitment: hexSchema, memo: hexSchema }).strict();
export async function scanMemos(reader: PublicClient, abi: Abi, board: BoardConfig, block: bigint): Promise<Memo[]> {
    if (board.chunkSize <= 0n || block < board.deployBlock)
        throw new Error('MEMO_RANGE_INVALID');
    const memos: Memo[] = [];
    for (let from = board.deployBlock; from <= block; from += board.chunkSize) {
        const to = from + board.chunkSize - 1n > block ? block : from + board.chunkSize - 1n;
        const logs = await reader.getLogs({ address: board.address, fromBlock: from, toBlock: to });
        for (const log of logs) {
            const metadata = z.object({ removed: z.literal(false), block: z.bigint(), hash: hexSchema }).strict()
                .safeParse({ removed: log.removed, block: log.blockNumber, hash: log.transactionHash });
            if (!metadata.success)
                throw new Error('MEMO_LOG_INVALID');
            const decoded: unknown = decodeEventLog({ abi, data: log.data, topics: log.topics, strict: true });
            const event = z.object({ eventName: z.string(), args: z.unknown() }).passthrough().parse(decoded);
            if (event.eventName !== 'PaymentMemo')
                continue;
            const args = memoArgs.safeParse(event.args);
            if (!args.success)
                throw new Error('MEMO_LOG_INVALID');
            memos.push({ commitment: args.data.paymentCommitment, envelope: hexToBytes(args.data.memo), hash: log.transactionHash, block: log.blockNumber });
        }
    }
    return memos;
}
export async function postTicket(journal: Journal, paymentId: string, commitment: Hex, envelope: Uint8Array, abi: Abi, gateway: Gateway) {
    ticketMetadata(envelope);
    const payment = journal.read().operations.find(operation => operation.id === paymentId);
    if (!payment || (payment.stage !== 'LANDED' && payment.stage !== 'TICKET_POSTED') || payment.receipt?.status !== 'success' ||
        !payment.prepared?.outputs.some(note => note.commitment === commitment && note.owner !== journal.owner))
        throw new Error('PAYMENT_REQUIRED');
    const sha3: Hex = `0x${createHash('sha3-256').update(envelope).digest('hex')}`;
    const memoId = `${paymentId}-memo`;
    const result = await executeOperation(journal, { id: memoId, input: null,
        requestKey: JSON.stringify(['memo', paymentId, commitment, sha3]),
        build: () => Promise.resolve().then(() => ({ data: encodeFunctionData({ abi, functionName: 'postMemo', args: [commitment, toHex(envelope)] }),
            valueWei: '0', root: null, nullifier: null, feeWei: '0', outputs: [] })),
    }, { ...gateway, included: () => Promise.resolve().then(() => true) });
    if (result.kind !== 'LANDED' || !result.operation.hash)
        return result;
    const memoHash = result.operation.hash;
    await journal.exclusive(() => {
        return Promise.resolve().then(() => {
            const data = journal.read();
            const current = data.operations.find(operation => operation.id === paymentId);
            if (!current || current.receipt?.status !== 'success')
                throw new Error('PAYMENT_REQUIRED');
            current.stage = 'TICKET_POSTED';
            current.ticket = { memoId, memoHash, commitment, sha3 };
            current.updatedAt = new Date().toISOString();
            journal.save(data);
        });
    });
    return result;
}
