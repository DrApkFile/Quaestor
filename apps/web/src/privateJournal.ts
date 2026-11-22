import { journalSchema, type JournalData } from '@quaestor/chain/journal';
import type { Gateway } from '@quaestor/chain/executor';
import type { PrivateStorage } from './privateStore.js';
export class PrivateJournal {
  private data: JournalData = { v: 1, notes: [], operations: [] };
  private queue = Promise.resolve();
  private locked = false;
  readonly path = 'private-journal';
  readonly owner: JournalData['notes'][number]['owner'] = 'business';
  constructor(
    private readonly storage: PrivateStorage,
    private readonly address: string,
  ) {}
  static async open(storage: PrivateStorage, address: string) {
    const journal = new PrivateJournal(storage, address);
    await journal.reload();
    return journal;
  }
  private async reload() {
    const saved = await this.storage.get(this.path);
    if (saved !== undefined) this.data = journalSchema.parse(saved);
  }
  read() {
    return structuredClone(this.data);
  }
  save(value: JournalData) {
    const data = journalSchema.parse(value);
    this.data = structuredClone(data);
    this.queue = this.queue.then(() => this.storage.put(this.path, data));
  }
  protectGateway(gateway: Gateway, before?: () => Promise<unknown>): Gateway {
    return {
      ...gateway,
      broadcast: async (serialized) => {
        await this.flush();
        await before?.();
        return gateway.broadcast(serialized);
      },
    };
  }
  flush() {
    return this.queue;
  }
  async exclusive<T>(work: () => Promise<T>): Promise<T> {
    if (this.locked) throw new Error('JOURNAL_LOCKED');
    this.locked = true;
    const run = async () => {
      await this.flush();
      await this.reload();
      try {
        return await work();
      } finally {
        await this.flush();
      }
    };
    try {
      const locks =
        typeof navigator === 'undefined' ? undefined : (Reflect.get(navigator, 'locks') as LockManager | undefined);
      if (!locks) return await run();
      const result: unknown = await locks.request(`quaestor:${this.address}`, { ifAvailable: true }, async (lock) => {
        if (!lock) throw new Error('JOURNAL_LOCKED');
        return run();
      });
      return result as T;
    } finally {
      this.locked = false;
    }
  }
}
