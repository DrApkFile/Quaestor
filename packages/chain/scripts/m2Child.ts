import { z } from 'zod';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import type { Hex } from 'viem';
import { m2Root } from './m2Context.js';
import { workerSchema, type WorkerResult } from './m2Evidence.js';

export async function launchM2Worker(role: 'supplier1' | 'client', commitment: Hex, memoHash: Hex, run = 'm2'): Promise<WorkerResult> {
  const validate = (raw: unknown) => {
    const result = workerSchema.parse(raw);
    if (result.role !== role || result.loadedAccounts[0] !== role || result.commitment !== commitment || result.memoHash !== memoHash ||
      result.journal !== `.accounts/${run}/${role}.json`) throw new Error('WORKER_OUTPUT_INVALID');
    return result;
  };
  const cache = `${m2Root}/.accounts/${run}/${role}-result.json`;
  if (existsSync(cache)) {
    const raw: unknown = JSON.parse(readFileSync(cache, 'utf8'));
    return validate(raw);
  }
  const output = await new Promise<string>((resolve, reject) => {
    const process = spawn('pnpm', ['-C', 'packages/chain', 'exec', 'tsx', '../../scripts/m2-receive.ts', role, commitment, memoHash, run],
      { cwd: m2Root, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    process.stdout.setEncoding('utf8');
    process.stdout.on('data', (chunk: string) => { stdout += chunk; });
    process.stderr.setEncoding('utf8');
    process.stderr.on('data', (chunk: string) => { if (stderr.length < 10000) stderr += chunk; });
    process.on('error', () => reject(new Error('WORKER_LAUNCH_FAILED')));
    process.on('close', code => {
      if (code === 0) { resolve(stdout); return; }
      let errorCode = 'WORKER_FAILED';
      try {
        const raw: unknown = JSON.parse(stderr);
        const parsed = z.object({ errorCode: z.string().regex(/^[A-Z_]+$/) }).strict().safeParse(raw);
        if (parsed.success) errorCode = parsed.data.errorCode;
      } catch { errorCode = 'WORKER_FAILED'; }
      reject(new Error(errorCode));
    });
  });
  let raw: unknown;
  try { raw = JSON.parse(output) as unknown; } catch { throw new Error('WORKER_OUTPUT_INVALID'); }
  return validate(raw);
}

export function readM2WorkerProgress(role: 'supplier1' | 'client', run = 'm2'): WorkerResult | null {
  const path = `${m2Root}/.accounts/${run}/${role}-progress.json`;
  if (!existsSync(path)) return null;
  const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
  const parsed = workerSchema.safeParse(raw);
  return parsed.success && parsed.data.role === role ? parsed.data : null;
}
