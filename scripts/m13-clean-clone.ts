import {
  mkdirSync,
  copyFileSync,
  mkdtempSync,
  openSync,
  closeSync,
  writeSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = new URL('../', import.meta.url);
const directory = mkdtempSync(join(tmpdir(), 'quaestor-m13-'));
const clone = join(directory, 'repo');
const output = new URL('evidence/m13-clean-clone.txt', root);
const previous = existsSync(output) ? readFileSync(output) : null;
if (previous) writeFileSync(new URL(`evidence/m13-clean-clone-attempt-${String(Date.now())}.txt`, root), previous);
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
    `pnpm evidence --m13-clean-clone\nStarted: ${new Date().toISOString()}\nFresh clone from pushed GitHub repository; shared machine tools/package cache, no account fixtures copied.\n`,
  );
  run('node', ['--version'], root.pathname);
  run('pnpm', ['--version'], root.pathname);
  run('forge', ['--version'], root.pathname);
  run('git', ['clone', 'https://github.com/DrApkFile/Quaestor.git', clone], directory);
  const expected = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  run('git', ['checkout', '--detach', expected], clone);
  run('git', ['rev-parse', 'HEAD'], clone);
  if (existsSync(join(clone, '.accounts')) || existsSync(join(clone, '.env')))
    throw new Error('PRIVATE_FIXTURES_IN_CLONE');
  writeSync(fd, 'Private account fixtures and root .env absent from the fresh clone.\n');
  run('pnpm', ['install', '--frozen-lockfile'], clone);
  const upstream = join(directory, 'gloam');
  run('git', ['clone', '--quiet', 'https://github.com/gloamtrade/gloam.git', upstream], directory);
  run('git', ['checkout', '--quiet', 'd8db1e6c805c5887678fa2c6c82ea617efe1659c'], upstream);
  mkdirSync(join(clone, 'apps/web/public/circuits'), { recursive: true });
  for (const name of ['shield', 'transfer', 'unshield', 'receipt', 'payroll_total', 'funds']) {
    for (const file of [`${name}.wasm`, `final/${name}_final.zkey`, `final/${name}_vkey.json`])
      copyFileSync(
        join(upstream, 'app/public/circuits', file),
        join(clone, 'apps/web/public/circuits', file.split('/').at(-1) ?? ''),
      );
  }
  writeSync(fd, 'Copied self-hosted circuits from pinned public upstream; contract vendor directory untouched.\n');
  run('pnpm', ['-C', 'contracts', 'forge-std'], clone);
  run('git', ['diff', '--exit-code', '--', 'contracts/vendor/gloam/'], clone);
  run('pnpm', ['gate'], clone);
  run('pnpm', ['-C', 'apps/web', 'build'], clone);
  run('git', ['status', '--short'], clone);
  writeSync(fd, '\nM13 CLEAN CLONE PASSED. External recording and submission remain builder tasks.\n');
  passed = true;
} finally {
  writeSync(fd, `Finished: ${new Date().toISOString()}\nResult: ${passed ? 'PASSED' : 'FAILED'}\n`);
  closeSync(fd);
  console.log(`Pre-submit ${passed ? 'PASSED' : 'FAILED'}; exact output: evidence/m13-clean-clone.txt`);
}
