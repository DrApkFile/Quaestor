import { spawn } from 'node:child_process';
import { existsSync, copyFileSync, writeFileSync, appendFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const report = new URL('evidence/m12-axe.json', root);
const prior = new URL(`evidence/m12-axe-attempt-${String(Date.now())}.json`, root);
const ledgerOnly = process.argv.includes('--ledger-recheck');
if (existsSync(report)) copyFileSync(report, prior);
else if (ledgerOnly) throw new Error('FULL_AXE_SWEEP_REQUIRED');
const log = new URL(`evidence/m12-axe-run-${String(Date.now())}.txt`, root);
writeFileSync(log, '');
const child = spawn(
  'pnpm',
  ['-C', 'apps/web', 'exec', 'playwright', 'test', '--config=playwright.m9.config.ts', 'm12Axe.spec.ts'],
  {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...(ledgerOnly ? { QUAESTOR_M12_RECHECK: 'ledger' } : {}) },
  },
);
for (const stream of [child.stdout, child.stderr])
  stream.on('data', (bytes: Buffer) => {
    appendFileSync(log, bytes);
    process.stdout.write(bytes);
  });
const code = await new Promise<number | null>((resolve, reject) => {
  child.on('error', reject);
  child.on('exit', resolve);
});
appendFileSync(log, `\nexit=${String(code)}\n`);
if (code !== 0) process.exitCode = 1;

if (code === 0 && ledgerOnly) {
  const { mergeAxe } = await import('./m12-axe-merge.js');
  mergeAxe(prior, report);
}
