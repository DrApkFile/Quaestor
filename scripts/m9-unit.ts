import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const args = [
  '-C',
  'apps/web',
  'exec',
  'vitest',
  'run',
  'test/activation.test.ts',
  'test/presentation.test.ts',
  'test/relayPath.test.ts',
];
const result = spawnSync('pnpm', args, { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
writeFileSync(
  new URL('../evidence/m9-unit.json', import.meta.url),
  JSON.stringify(
    {
      command: 'pnpm evidence --m9-unit',
      executed: `pnpm ${args.join(' ')}`,
      at: new Date().toISOString(),
      exit: result.status,
      output: result.stdout + result.stderr,
      status: result.status === 0 ? 'PASSED' : 'FAILED',
    },
    null,
    2,
  ) + '\n',
);
console.log(result.stdout + result.stderr);
process.exitCode = result.status ?? 1;
