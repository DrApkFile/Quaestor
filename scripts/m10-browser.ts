import { execFileSync, spawnSync } from 'node:child_process';
import { newM10AttemptId } from '../apps/web/e2e/m10Attempt.js';
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
  {
    cwd: new URL('../', import.meta.url),
    stdio: 'inherit',
    env: {
      ...process.env,
      ...(signup
        ? {
            QUAESTOR_M10_ATTEMPT: newM10AttemptId(),
            QUAESTOR_M10_SOURCE_COMMIT: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
          }
        : {}),
    },
  },
);
process.exitCode = result.status ?? 1;
