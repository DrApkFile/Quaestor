import { mkdtempSync, openSync, closeSync, writeSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = new URL('../', import.meta.url);
const directory = mkdtempSync(join(tmpdir(), 'quaestor-m8-'));
const clone = join(directory, 'repo');
const output = new URL('evidence/m8-presubmit.txt', root);
const previous = existsSync(output) ? readFileSync(output) : null;
if (previous) writeFileSync(new URL(`evidence/m8-presubmit-attempt-${String(Date.now())}.txt`, root), previous);
const fd = openSync(output, 'w', 0o644);
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) => !/PRIVATE|MNEMONIC|SECRET|PASSWORD|TOKEN|^QORE_|^QUAESTOR_/.test(name),
  ),
);
const run = (command: string, args: string[], cwd: string) => {
  writeSync(fd, `\n$ ${command} ${args.join(' ')}\n`);
  console.log(`Pre-submit: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd, env, stdio: ['ignore', fd, fd] });
  writeSync(fd, `\nexit=${String(result.status)} signal=${result.signal ?? 'none'}\n`);
  if (result.status !== 0) throw new Error('PRESUBMIT_COMMAND_FAILED');
};
let passed = false;
try {
  writeSync(
    fd,
    `pnpm evidence --m8-presubmit\nStarted: ${new Date().toISOString()}\nFresh local clone; shared machine tools/package cache, no account fixtures copied.\n`,
  );
  run('node', ['--version'], root.pathname);
  run('pnpm', ['--version'], root.pathname);
  run('forge', ['--version'], root.pathname);
  run('git', ['clone', '--no-hardlinks', root.pathname, clone], directory);
  run('git', ['rev-parse', 'HEAD'], clone);
  run('pnpm', ['install', '--frozen-lockfile'], clone);
  run('bash', ['scripts/vendor-gloam.sh'], clone);
  run('git', ['diff', '--exit-code', '--', 'contracts/vendor/gloam/'], clone);
  run('pnpm', ['gate'], clone);
  run('pnpm', ['-C', 'apps/web', 'build'], clone);
  run('git', ['status', '--short'], clone);
  writeSync(
    fd,
    '\nBUILD AUDIT PASSED. See docs/PRESUBMIT.md for the full checklist and unperformed external submission items.\n',
  );
  passed = true;
} finally {
  writeSync(fd, `Finished: ${new Date().toISOString()}\nResult: ${passed ? 'PASSED' : 'FAILED'}\n`);
  closeSync(fd);
  console.log(`Pre-submit ${passed ? 'PASSED' : 'FAILED'}; exact output: evidence/m8-presubmit.txt`);
}
