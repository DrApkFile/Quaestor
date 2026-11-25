import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
export const m10AttemptIdSchema = z.string().regex(/^m10-\d{13}-[a-f0-9]{16}$/);
export function newM10AttemptId() {
  return m10AttemptIdSchema.parse(`m10-${String(Date.now())}-${randomBytes(8).toString('hex')}`);
}
export function m10Attempt(
  id: unknown = process.env.QUAESTOR_M10_ATTEMPT,
  commit: unknown = process.env.QUAESTOR_M10_SOURCE_COMMIT,
) {
  const attemptId = m10AttemptIdSchema.parse(id);
  const sourceCommit = z
    .string()
    .regex(/^[a-f0-9]{40}$/)
    .parse(commit);
  return {
    id: attemptId,
    sourceCommit,
    directory: `../../.accounts/m10-browser/attempts/${attemptId}`,
    phase: `after-${attemptId}`,
  };
}
export function reserveM10Session(directory: string, password: string) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  try {
    writeFileSync(`${directory}/signup-session.json`, JSON.stringify({ password }), { mode: 0o600, flag: 'wx' });
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST')
      throw new Error('FRESH_SIGNUP_PROFILE_ALREADY_USED');
    throw error;
  }
}
