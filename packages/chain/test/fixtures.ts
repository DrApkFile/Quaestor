import { vi } from 'vitest';
import type { Gateway, Request } from '../src/executor.js';
import type { Prepared, StoredNote, StoredReceipt } from '../src/journal.js';
export const hash = `0x${'ab'.repeat(32)}` as const;
export const commitment = `0x${'cd'.repeat(32)}` as const;
export const note: StoredNote = {
    secret: `0x${'01'.repeat(32)}`, commitment, nullifier: `0x${'02'.repeat(32)}`,
    asset: '0x0000000000000000000000000000000000000000', amountWei: '5', owner: 'business', state: 'OWNED',
};
export const output: StoredNote = { ...note, commitment: `0x${'ef'.repeat(32)}`, owner: 'supplier1', state: 'INCOMING' };
export const prepared: Prepared = { data: '0x1234', valueWei: '0', root: commitment,
    nullifier: note.nullifier, feeWei: '0', outputs: [output] };
export const receipt: StoredReceipt = { hash, blockNumber: '10', blockHash: hash,
    gasUsed: '20', effectiveGasPrice: '30', status: 'success' };
export function fakeGateway() {
    return {
        windowOpen: vi.fn(() => Promise.resolve().then(() => true)),
        sign: vi.fn<Gateway['sign']>(() => Promise.resolve().then(() => ({ serialized: '0xab', hash }))),
        broadcast: vi.fn<Gateway['broadcast']>(() => Promise.resolve().then(() => hash)),
        receipt: vi.fn<Gateway['receipt']>(() => Promise.resolve().then(() => receipt)),
        included: vi.fn<Gateway['included']>(() => Promise.resolve().then(() => true)),
    };
}
export function request(input: Request['input'] = commitment): Request {
    return { id: 'send', requestKey: 'business-send', input, build: vi.fn(() => Promise.resolve().then(() => prepared)) };
}
