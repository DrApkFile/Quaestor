import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Role } from './roles.js';
import { writePrivateJson } from './storage.js';
export * from './journalSchema.js';
import { journalSchema, type JournalData } from './journalSchema.js';
export class Journal {
  constructor(
    readonly path: string,
    readonly owner?: Role,
  ) {}
  read(): JournalData {
    if (!existsSync(this.path)) return { v: 1, operations: [], notes: [] };
    const body: unknown = JSON.parse(readFileSync(this.path, 'utf8'));
    const parsed = journalSchema.safeParse(body);
    if (!parsed.success || (this.owner !== undefined && parsed.data.notes.some((note) => note.owner !== this.owner)))
      throw new Error('JOURNAL_INVALID');
    return parsed.data;
  }
  save(data: JournalData): void {
    const parsed = journalSchema.safeParse(data);
    if (!parsed.success || (this.owner !== undefined && parsed.data.notes.some((note) => note.owner !== this.owner)))
      throw new Error('JOURNAL_INVALID');
    writePrivateJson(this.path, parsed.data);
  }
  async exclusive<T>(run: () => Promise<T>): Promise<T> {
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    let descriptor: number;
    try {
      descriptor = openSync(`${this.path}.lock`, 'wx', 0o600);
    } catch {
      throw new Error('JOURNAL_LOCKED');
    }
    try {
      return await run();
    } finally {
      closeSync(descriptor);
      unlinkSync(`${this.path}.lock`);
    }
  }
}
