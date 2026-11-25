import { spawnSync } from 'node:child_process';
const specs: Record<string, string> = {
  '--m10b-window-reopen': 'm10bWindow.spec.ts',
  '--m10b-screens': 'm10Readback.spec.ts',
};
const spec = specs[process.argv[2] ?? ''];
if (!spec) throw new Error('UNKNOWN_M10B_COMMAND');
const result = spawnSync(
  'pnpm',
  ['-C', 'apps/web', 'exec', 'playwright', 'test', '--config=playwright.m9.config.ts', spec],
  {
    cwd: new URL('../', import.meta.url),
    stdio: 'inherit',
    env: { ...process.env, QUAESTOR_M10_RUN: 'm10b', QUAESTOR_M10_PHASE: 'after' },
  },
);
process.exitCode = result.status ?? 1;
