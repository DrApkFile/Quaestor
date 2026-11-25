import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
const specs: Record<string, string> = {
  '--m10b-window-reopen': 'm10bWindow.spec.ts',
  '--m10b-screens': 'm10Readback.spec.ts',
};
const command = process.argv[2] ?? '';
const spec = specs[command];
if (!spec) throw new Error('UNKNOWN_M10B_COMMAND');
const root = new URL('../', import.meta.url);
const target = new URL(`evidence/${command.slice(2)}.txt`, root);
if (existsSync(target))
  copyFileSync(target, new URL(`evidence/${command.slice(2)}-attempt-${String(Date.now())}.txt`, root));
const startedAt = new Date().toISOString();
const result = spawnSync(
  'pnpm',
  ['-C', 'apps/web', 'exec', 'playwright', 'test', '--config=playwright.m9.config.ts', spec],
  {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16000000,
    env: { ...process.env, QUAESTOR_M10_RUN: 'm10b', QUAESTOR_M10_PHASE: 'after' },
  },
);
writeFileSync(
  target,
  `Command: pnpm evidence ${command}\nOrigin: ${process.env.QUAESTOR_M9_ORIGIN ?? 'https://use-quaestor.vercel.app'}\nStarted: ${startedAt}\n${result.stdout}${result.stderr}\nexit=${String(result.status)}\n`,
);
console.log(result.stdout + result.stderr);
process.exitCode = result.status ?? 1;
