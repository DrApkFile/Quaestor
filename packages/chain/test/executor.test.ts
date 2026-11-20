import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { executeOperation, resolveOperation } from '../src/executor.js';
import { Journal } from '../src/journal.js';
import { commitment, fakeGateway, hash, note, request } from './fixtures.js';
let directory: string;
let journal: Journal;
beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'quaestor-'));
    journal = new Journal(join(directory, 'journal.json'));
    journal.save({ v: 1, operations: [], notes: [{ ...note }] });
});
afterEach(() => { rmSync(directory, { recursive: true, force: true }); });
it('T-WINDOW refuses a closed window before proving or sending any transaction', async () => {
    const gateway = fakeGateway();
    gateway.windowOpen.mockResolvedValue(false);
    const operation = request();
    expect(await executeOperation(journal, operation, gateway)).toEqual({ kind: 'WINDOW_CLOSED' });
    expect(operation.build).not.toHaveBeenCalled();
    expect(gateway.broadcast).not.toHaveBeenCalled();
    expect(journal.read().notes[0]?.state).toBe('OWNED');
});
it('T-JOURNAL holds a throwing broadcast and refuses to rebuild that spend after restart', async () => {
    const gateway = fakeGateway();
    gateway.broadcast.mockImplementation(() => {
        return Promise.resolve().then(() => {
            const saved = journal.read();
            expect(saved.operations[0]).toMatchObject({ stage: 'BROADCAST', hash });
            expect(saved.notes.map(item => item.state)).toEqual(['SPENDING', 'INCOMING']);
            throw new Error('timeout');
        });
    });
    const operation = request();
    expect(await executeOperation(journal, operation, gateway)).toEqual({ kind: 'OUTCOME_UNKNOWN' });
    const restarted = new Journal(journal.path);
    expect(restarted.read().operations[0]?.stage).toBe('OUTCOME_UNKNOWN');
    expect(await executeOperation(restarted, operation, gateway)).toEqual({ kind: 'OUTCOME_UNKNOWN' });
    expect(operation.build).toHaveBeenCalledTimes(1);
    expect(gateway.broadcast).toHaveBeenCalledTimes(1);
    expect(await executeOperation(restarted, { ...request(), id: 'another' }, gateway)).toEqual({ kind: 'NOTE_SPENT' });
    expect((await resolveOperation(restarted, 'send', gateway)).kind).toBe('LANDED');
    expect(restarted.read().notes.map(item => item.state)).toEqual(['SPENT', 'OWNED']);
});
it('T-NOTES owns a deposit only after a successful receipt and tree inclusion', async () => {
    const gateway = fakeGateway();
    gateway.receipt.mockImplementation(() => {
        return Promise.resolve().then(() => {
            expect(journal.read().notes.at(-1)?.state).toBe('INCOMING');
            throw new Error('receipt unavailable');
        });
    });
    await executeOperation(journal, request(null), gateway);
    expect(journal.read().notes.at(-1)?.state).toBe('INCOMING');
    gateway.receipt.mockResolvedValue({ hash, blockNumber: '10', blockHash: hash,
        gasUsed: '20', effectiveGasPrice: '30', status: 'success' });
    gateway.included.mockResolvedValue(false);
    expect(await resolveOperation(journal, 'send', gateway)).toEqual({ kind: 'OUTCOME_UNKNOWN' });
    expect(journal.read().notes.at(-1)?.state).toBe('INCOMING');
    gateway.included.mockResolvedValue(true);
    expect((await resolveOperation(journal, 'send', gateway)).kind).toBe('LANDED');
    expect(journal.read().notes.at(-1)?.state).toBe('OWNED');
});
it('T-NOTES preserves an input until receipt and restores it when the transaction reverts', async () => {
    const gateway = fakeGateway();
    gateway.receipt.mockResolvedValue({ hash, blockNumber: '10', blockHash: hash,
        gasUsed: '20', effectiveGasPrice: '30', status: 'reverted' });
    expect(await executeOperation(journal, request(), gateway)).toEqual({ kind: 'TRANSACTION_REVERTED' });
    expect(journal.read().notes).toEqual([note]);
    expect(gateway.included).not.toHaveBeenCalled();
});
it('T-JOURNAL serializes concurrent spends and persists files readable only by their owner', async () => {
    const gateway = fakeGateway();
    const results = await Promise.allSettled([
        executeOperation(journal, request(), gateway), executeOperation(journal, { ...request(), id: 'second' }, gateway),
    ]);
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(gateway.broadcast).toHaveBeenCalledTimes(1);
    expect(statSync(journal.path).mode & 0o777).toBe(0o600);
});
it('T-JOURNAL refuses changed parameters under an existing operation id', async () => {
    const gateway = fakeGateway();
    await executeOperation(journal, request(), gateway);
    expect(await executeOperation(journal, { ...request(), requestKey: 'different' }, gateway)).toEqual({ kind: 'REQUEST_CONFLICT' });
    expect(gateway.broadcast).toHaveBeenCalledTimes(1);
    expect(journal.read().operations[0]?.input).toBe(commitment);
});
