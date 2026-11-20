import type { SignedGas } from './gas.js';
import type { Hex } from 'viem';
import { Journal, type JournalData, type Operation, type Prepared, type StoredReceipt } from './journal.js';

export interface Gateway {
  windowOpen(): Promise<boolean>;
  sign(prepared: Prepared): Promise<{ serialized: Hex; hash: Hex; gas?: SignedGas }>;
  broadcast(serialized: Hex): Promise<Hex>;
  receipt(hash: Hex): Promise<StoredReceipt>;
  included(commitments: Hex[], block: bigint): Promise<boolean>;
}
export type ExecutionResult = { kind: 'LANDED'; operation: Operation }
  | { kind: 'WINDOW_CLOSED' | 'OUTCOME_UNKNOWN' | 'NOTE_SPENT' | 'REQUEST_CONFLICT' | 'TRANSACTION_REVERTED' };
export interface Request {
  id: string;
  requestKey: string;
  input: Hex | null;
  build(): Promise<Prepared>;
}

async function settle(journal: Journal, data: JournalData, operation: Operation, gateway: Gateway): Promise<ExecutionResult> {
  if (!operation.hash || !operation.prepared) throw new Error('JOURNAL_INVALID');
  let receipt: StoredReceipt;
  try { receipt = await gateway.receipt(operation.hash); }
  catch {
    operation.stage = 'OUTCOME_UNKNOWN';
    operation.updatedAt = new Date().toISOString();
    journal.save(data);
    return { kind: 'OUTCOME_UNKNOWN' };
  }
  if (receipt.hash.toLowerCase() !== operation.hash.toLowerCase()) throw new Error('RECEIPT_HASH_MISMATCH');
  operation.receipt = receipt;
  journal.save(data);
  if (receipt.status === 'success') {
    const commitments = operation.prepared.outputs.map(note => note.commitment);
    if (!(await gateway.included(commitments, BigInt(receipt.blockNumber)))) return { kind: 'OUTCOME_UNKNOWN' };
  }
  const input = data.notes.find(note => note.commitment === operation.input);
  if (input) input.state = receipt.status === 'success' ? 'SPENT' : 'OWNED';
  const outputs = new Set(operation.prepared.outputs.map(note => note.commitment));
  if (receipt.status === 'success') {
    for (const note of data.notes) if (outputs.has(note.commitment)) note.state = 'OWNED';
  } else {
    data.notes = data.notes.filter(note => !outputs.has(note.commitment));
  }
  operation.stage = 'LANDED';
  operation.updatedAt = new Date().toISOString();
  journal.save(data);
  return receipt.status === 'success' ? { kind: 'LANDED', operation } : { kind: 'TRANSACTION_REVERTED' };
}

export function resolveOperation(journal: Journal, id: string, gateway: Gateway): Promise<ExecutionResult> {
  return journal.exclusive(async () => {
    const data = journal.read();
    const operation = data.operations.find(item => item.id === id);
    if (!operation || !operation.hash) throw new Error('TRANSACTION_HASH_REQUIRED');
    if (operation.stage === 'LANDED') {
      return operation.receipt?.status === 'success' ? { kind: 'LANDED', operation } : { kind: 'TRANSACTION_REVERTED' };
    }
    return settle(journal, data, operation, gateway);
  });
}

export function executeOperation(journal: Journal, request: Request, gateway: Gateway): Promise<ExecutionResult> {
  return journal.exclusive(async () => {
    const data = journal.read();
    let operation = data.operations.find(item => item.id === request.id);
    if (operation && (operation.requestKey !== request.requestKey || operation.input !== request.input)) {
      return { kind: 'REQUEST_CONFLICT' };
    }
    if (operation?.stage === 'LANDED') {
      return operation.receipt?.status === 'success' ? { kind: 'LANDED', operation } : { kind: 'TRANSACTION_REVERTED' };
    }
    if (operation?.stage === 'BROADCAST' || operation?.stage === 'OUTCOME_UNKNOWN') return { kind: 'OUTCOME_UNKNOWN' };
    if (!(await gateway.windowOpen())) return { kind: 'WINDOW_CLOSED' };
    if (!operation) {
      const input = data.notes.find(note => note.commitment === request.input);
      if (request.input && (!input || input.state !== 'OWNED')) return { kind: 'NOTE_SPENT' };
      if (input) input.state = 'SPENDING';
      const now = new Date().toISOString();
      operation = { id: request.id, requestKey: request.requestKey, input: request.input, stage: 'PLANNED',
        prepared: null, hash: null, receipt: null, plannedAt: now, updatedAt: now };
      data.operations.push(operation);
      journal.save(data);
    }
    if (!operation.prepared) {
      operation.prepared = await request.build();
      data.notes.push(...operation.prepared.outputs.map(note => ({ ...note, state: 'INCOMING' as const })));
      operation.stage = 'PROVED';
      operation.updatedAt = new Date().toISOString();
      journal.save(data);
    }
    const signed = await gateway.sign(operation.prepared);
    operation.stage = 'BROADCAST';
    operation.hash = signed.hash;
    if (signed.gas) operation.gas = signed.gas;
    operation.updatedAt = new Date().toISOString();
    journal.save(data);
    try {
      const hash = await gateway.broadcast(signed.serialized);
      if (hash.toLowerCase() !== signed.hash.toLowerCase()) throw new Error('BROADCAST_HASH_MISMATCH');
    } catch {
      operation.stage = 'OUTCOME_UNKNOWN';
      journal.save(data);
      return { kind: 'OUTCOME_UNKNOWN' };
    }
    return settle(journal, data, operation, gateway);
  });
}
