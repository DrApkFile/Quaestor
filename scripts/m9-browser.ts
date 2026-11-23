import { spawnSync } from 'node:child_process';
const result = spawnSync(
  'pnpm',
  [
    '-C',
    'apps/web',
    'exec',
    'playwright',
    'test',
    '--config=playwright.m9.config.ts',
    process.argv[2] === '--m9-wallet-readback'
      ? 'm9Readback.spec.ts'
      : process.argv[2] === '--m9-fresh-signup'
        ? 'm9Signup.spec.ts'
        : process.argv[2] === '--m9-manual-retry'
          ? 'm9ManualRetry.spec.ts'
          : 'm9Judge.spec.ts',
  ],
  { cwd: new URL('../', import.meta.url), stdio: 'inherit', env: process.env },
);
process.exitCode = result.status ?? 1;
