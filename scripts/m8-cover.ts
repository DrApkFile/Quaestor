import { spawnSync } from 'node:child_process';
const result = spawnSync(
  'pnpm',
  ['-C', 'apps/web', 'exec', 'playwright', 'test', 'm8Cover.spec.ts', '--config', 'playwright.cover.config.ts'],
  {
    cwd: new URL('../', import.meta.url),
    stdio: 'inherit',
  },
);
process.exitCode = result.status ?? 1;
