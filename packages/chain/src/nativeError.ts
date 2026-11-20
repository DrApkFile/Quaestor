import { z } from 'zod';
import type { UnifiedAccount } from '@qorechain/sdk';

export const nativeFailureSchema = z.object({
  code: z.number().int().nullable(), codespace: z.string().nullable(), rawLog: z.string().max(500).nullable(),
  hash: z.string().regex(/^[\da-fA-F]{64}$/).nullable(),
}).strict();
export type NativeFailure = z.infer<typeof nativeFailureSchema>;
const responseSchema = z.object({
  code: z.number().int().optional(), codespace: z.string().optional(),
  rawLog: z.string().optional(), log: z.string().optional(),
  txHash: z.string().optional(), transactionHash: z.string().optional(),
}).passthrough();

export function redactNativeText(text: string, secrets: readonly string[]): string {
  let sanitized = text;
  for (const secret of secrets) if (secret.length > 0) sanitized = sanitized.split(secret).join('[REDACTED]');
  return sanitized.replace(/(?:0x)?[\da-fA-F]{64,}/g, '[REDACTED]')
    .replace(/[A-Za-z0-9+/=_-]{80,}/g, '[REDACTED]').slice(0, 500);
}
export function accountSecrets(account: UnifiedAccount): string[] {
  return [account.mnemonic ?? '', account.privateKey, account.privateKey.slice(2),
    Buffer.from(account.pqc.secretKey).toString('hex'), Buffer.from(account.pqc.secretKey).toString('base64'),
    Buffer.from(account.pqc.publicKey).toString('hex'), Buffer.from(account.pqc.publicKey).toString('base64')];
}
export class NativeBroadcastError extends Error implements NativeFailure {
  readonly kind: 'NATIVE_CHAIN_REJECTED' | 'NATIVE_BROADCAST_FAILED';
  readonly code: NativeFailure['code'];
  readonly codespace: NativeFailure['codespace'];
  readonly rawLog: NativeFailure['rawLog'];
  readonly hash: NativeFailure['hash'];
  constructor(error: unknown, secrets: readonly string[]) {
    const parsed = responseSchema.safeParse(error);
    const data = parsed.success ? parsed.data : {};
    const kind = data.code !== undefined && data.code !== 0 ? 'NATIVE_CHAIN_REJECTED' : 'NATIVE_BROADCAST_FAILED';
    super(kind);
    this.name = 'NativeBroadcastError';
    this.kind = kind;
    this.code = data.code ?? null;
    this.codespace = data.codespace === undefined ? null : redactNativeText(data.codespace, secrets);
    const log = data.rawLog ?? data.log;
    this.rawLog = log === undefined ? null : redactNativeText(log, secrets);
    const hash = data.transactionHash ?? data.txHash;
    const isSecret = hash !== undefined && secrets.some(secret => secret.toLowerCase().replace(/^0x/, '') === hash.toLowerCase());
    this.hash = hash && /^[\da-fA-F]{64}$/.test(hash) && !isSecret ? hash : null;
  }
  fields(): NativeFailure {
    return { code: this.code, codespace: this.codespace, rawLog: this.rawLog, hash: this.hash };
  }
}
