import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { m10Attempt, reserveM10Session } from '../e2e/m10Attempt.js';
const commit = 'a'.repeat(40);
it('A11 separate fresh attempts use different guarded backup directories and screenshot prefixes', () => {
  const first = m10Attempt('m10-1790000000000-aaaaaaaaaaaaaaaa', commit);
  const second = m10Attempt('m10-1790000000001-bbbbbbbbbbbbbbbb', commit);
  expect(first.directory).not.toBe(second.directory);
  expect(first.phase).not.toBe(second.phase);
  expect(first.directory).toContain('/attempts/');
  expect(() => m10Attempt('../../old-account', commit)).toThrow();
});
it('A11 a used attempt never overwrites its original session when started again', () => {
  const directory = mkdtempSync(join(tmpdir(), 'quaestor-m10-attempt-'));
  try {
    reserveM10Session(directory, 'fixture-first');
    const original = readFileSync(`${directory}/signup-session.json`, 'utf8');
    expect(() => {
      reserveM10Session(directory, 'fixture-second');
    }).toThrow('FRESH_SIGNUP_PROFILE_ALREADY_USED');
    expect(readFileSync(`${directory}/signup-session.json`, 'utf8')).toBe(original);
  } finally {
    rmSync(directory, { recursive: true });
  }
});
