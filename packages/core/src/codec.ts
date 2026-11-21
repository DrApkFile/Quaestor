import { sha3_256 } from '@noble/hashes/sha3.js';
import { toHex, keccak256, toBytes, encodePacked, type Hex, type Address } from 'viem';
import { z } from 'zod';

export const hex32 = z
  .string()
  .regex(/^0x[\da-fA-F]{64}$/)
  .transform((value) => value as Hex);
export const address = z
  .string()
  .regex(/^0x[\da-fA-F]{40}$/)
  .transform((value) => value as Address);
export const uint = z.string().regex(/^(0|[1-9]\d*)$/);
export const periodId = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const time = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
  });
export type CoreCode = 'INVALID_RECORD' | 'NOT_GRANTED' | 'TAMPERED' | 'CHAIN_BROKEN' | 'WRONG_CONTEXT' | 'UNANCHORED';
export class BookError extends Error {
  constructor(readonly code: CoreCode) {
    super(code);
    this.name = 'BookError';
  }
}
export function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item: unknown) => canonical(item)).join(',')}]`;
  if (typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]: [string, unknown]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  throw new BookError('INVALID_RECORD');
}
export const hashBytes = (value: Uint8Array): Hex => toHex(sha3_256(value));
export const hashRecord = (value: unknown): Hex => hashBytes(toBytes(canonical(value)));
export const contractPeriod = (period: string): Hex => keccak256(toBytes(periodId.parse(period)));
export const bookId = (owner: Address, salt: Hex): Hex =>
  keccak256(encodePacked(['address', 'bytes32'], [owner, salt]));
