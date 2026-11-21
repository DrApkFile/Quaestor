import { parseAbi } from 'viem';
import type { SealKeyPair } from '@qorechain/qoreseal';
import type { BooksConfig } from './booksReader.js';
import type { BlobContext } from './blobReader.js';
export const poolReadAbi = parseAbi([
  'function currentRoot() view returns (bytes32)',
  'function spent(bytes32) view returns (bool)',
]);
export interface AuditConfig extends BlobContext {
  books: BooksConfig;
  vkey: (name: 'receipt' | 'funds') => Promise<unknown>;
}
export interface AuditIdentity {
  address: string;
  keys: SealKeyPair;
}
