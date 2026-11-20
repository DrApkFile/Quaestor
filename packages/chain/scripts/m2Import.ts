import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';
import { hexSchema } from '../src/config.js';
import { Journal } from '../src/journal.js';
import { writePrivateJson } from '../src/storage.js';
import { syncPoolTree } from '../src/tree.js';
import { m2Root, type M2Context } from './m2Context.js';
const markerSchema = z.object({ commitment: hexSchema }).strict();
export async function importM1Change(context: M2Context) {
    const source = new Journal(`${m2Root}/.accounts/m1/journal.json`);
    const markerPath = `${m2Root}/.accounts/m2/business-import.json`;
    const payment = source.read().operations.find(operation => operation.id === 'send');
    const output = payment?.prepared?.outputs.find(note => note.owner === 'business' && note.amountWei === '3000000000000000000');
    if (!output)
        throw new Error('M1_CHANGE_REQUIRED');
    const destination = context.journal.read().notes.find(note => note.commitment === output.commitment);
    if (destination)
        return destination.commitment;
    const block = await context.reader.getBlockNumber({ cacheTime: 0 });
    const synced = await syncPoolTree(context.reader, context.config, context.poolAbi, block);
    const spent = await context.reader.readContract({ address: context.config.pool, abi: context.poolAbi,
        functionName: 'isSpent', args: [output.nullifier], blockNumber: block });
    if (spent !== false || !synced.tree.indexByCommitment.has(output.commitment.toLowerCase()))
        throw new Error('NOTE_SPENT');
    return source.exclusive(() => Promise.resolve().then(() => context.journal.exclusive(() => {
        return Promise.resolve().then(() => {
            const data = source.read();
            const note = data.notes.find(item => item.commitment === output.commitment && item.owner === 'business');
            if (!note || note.state === 'SPENT' || data.operations.some(operation => operation.input === output.commitment &&
                operation.stage !== 'LANDED' && operation.stage !== 'TICKET_POSTED'))
                throw new Error('NOTE_SPENT');
            if (note.state !== 'OWNED') {
                const raw: unknown = existsSync(markerPath) ? JSON.parse(readFileSync(markerPath, 'utf8')) as unknown : null;
                const marker = markerSchema.safeParse(raw);
                if (!marker.success || marker.data.commitment !== note.commitment)
                    throw new Error('NOTE_SPENT');
            }
            writePrivateJson(markerPath, { commitment: note.commitment });
            note.state = 'SPENDING';
            source.save(data);
            const receiving = context.journal.read();
            receiving.notes.push({ ...note, state: 'OWNED' });
            context.journal.save(receiving);
            return note.commitment;
        });
    })));
}
export async function finishM1Import(context: M2Context, commitment: `0x${string}`) {
    const landed = context.journal.read().operations.find(operation => operation.input === commitment &&
        (operation.stage === 'LANDED' || operation.stage === 'TICKET_POSTED') && operation.receipt?.status === 'success');
    if (!landed)
        throw new Error('RECEIPT_REQUIRED');
    const source = new Journal(`${m2Root}/.accounts/m1/journal.json`);
    await source.exclusive(() => {
        return Promise.resolve().then(() => {
            const data = source.read();
            const note = data.notes.find(item => item.commitment === commitment);
            if (!note)
                throw new Error('M1_CHANGE_REQUIRED');
            note.state = 'SPENT';
            source.save(data);
        });
    });
}
