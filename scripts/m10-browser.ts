import { spawnSync } from 'node:child_process';
const signup = process.argv[2] === '--m10-fresh-signup';
if (
  signup &&
  (process.env.QUAESTOR_M10_FAUCET_READY !== 'builder-confirmed' || Date.now() < Date.parse('2026-11-24T08:40:00Z'))
)
  throw new Error('BUILDER_FAUCET_READY_SIGNAL_REQUIRED_AFTER_0940_LAGOS_24_NOV');
const result = spawnSync(
  'pnpm',
  [
    '-C',
    'apps/web',
    'exec',
    'playwright',
    'test',
    '--config=playwright.m9.config.ts',
    signup
      ? 'm10Signup.spec.ts'
      : process.argv[2] === '--m10-cashout-retry'
        ? 'm10Cashout.spec.ts'
        : 'm10Readback.spec.ts',
  ],
  { cwd: new URL('../', import.meta.url), stdio: 'inherit', env: process.env },
);
process.exitCode = result.status ?? 1;
