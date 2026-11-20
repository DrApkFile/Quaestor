import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import type { Hex } from 'viem';
import { m2Root } from './m2Context.js';
import { workerSchema, type WorkerResult } from './m2Evidence.js';

export async function launchM2Worker(role: 'supplier1' | 'client', commitment: Hex, memoHash: Hex): Promise<WorkerResult> {
  const validate = (raw: unknown) => {
    const result = workerSchema.parse(raw);
    if (result.role !== role || result.loadedAccounts[0] !== role || result.commitment !== commitment || result.memoHash !== memoHash ||
      result.journal !== `.accounts/m2/${role}.json`) throw new Error('WORKER_OUTPUT_INVALID');
    return result;
  };
  const cache = `${m2Root}/.accounts/m2/${role}-result.json`;
  if (existsSync(cache)) {
    const raw: unknown = JSON.parse(readFileSync(cache, 'utf8'));
    return validate(raw);
  }
  const output = await new Promise<string>((resolve, reject) => {
    const process = spawn('pnpm', ['-C', 'packages/chain', 'exec', 'tsx', '../../scripts/m2-receive.ts', role, commitment, memoHash],
      { cwd: m2Root, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    process.stdout.setEncoding('utf8');
    process.stdout.on('data', (chunk: string) => { stdout += chunk; });
    process.stderr.resume();
    process.on('error', () => reject(new Error('WORKER_LAUNCH_FAILED')));
    process.on('close', code => code === 0 ? resolve(stdout) : reject(new Error('WORKER_FAILED')));
  });
  let raw: unknown;
  try { raw = JSON.parse(output) as unknown; } catch { throw new Error('WORKER_OUTPUT_INVALID'); }
  return validate(raw);
}
