import { journalSchema, type JournalData } from '@quaestor/chain/browser';
import { dbGet, dbPut } from './db.js';
export class BrowserJournal {
  readonly owner?: JournalData['notes'][number]['owner'];
  readonly path: string;
  private data: JournalData;
  private queue = Promise.resolve();
  private locked = false;
  constructor(address: string, data: JournalData) {
    this.path = `public-operations:${address}`;
    this.data = data;
  }
  static async open(address: string) {
    const value = await dbGet('journal', `public-operations:${address}`);
    return new BrowserJournal(
      address,
      value === undefined ? { v: 1, notes: [], operations: [] } : journalSchema.parse(value),
    );
  }
  read() {
    return structuredClone(this.data);
  }
  save(value: JournalData) {
    const data = journalSchema.parse(value);
    if (data.notes.length || data.operations.some((op) => op.input !== null || (op.prepared?.outputs.length ?? 0) > 0))
      throw new Error('PRIVATE_JOURNAL_NOT_IMPLEMENTED');
    this.data = data;
    this.queue = this.queue.then(() => dbPut('journal', this.path, data));
  }
  flush() {
    return this.queue;
  }
  async exclusive<T>(run: () => Promise<T>): Promise<T> {
    if (this.locked) throw new Error('JOURNAL_LOCKED');
    this.locked = true;
    try {
      return await run();
    } finally {
      try {
        await this.flush();
      } finally {
        this.locked = false;
      }
    }
  }
}
