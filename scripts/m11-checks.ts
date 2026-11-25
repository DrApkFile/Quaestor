import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const file = new URL('../evidence/m11-checks.txt', import.meta.url);
if (existsSync(file))
  copyFileSync(file, new URL(`../evidence/m11-checks-attempt-${String(Date.now())}.txt`, import.meta.url));
writeFileSync(
  file,
  `Command: pnpm evidence --m11-checks\nCommit: ${execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()}\n`,
);
const sourceFile = new URL('contracts/src/BlobBoard.sol', root);
const source = readFileSync(sourceFile, 'utf8');
try {
  writeFileSync(sourceFile, source.replace('data.length > 24576', 'data.length > 24577'));
  const result = spawnSync('pnpm', ['bytecode:check'], { cwd: root, encoding: 'utf8', maxBuffer: 16000000 });
  appendFileSync(
    file,
    `\nNegative control: temporarily change BlobBoard limit to 24577, run pnpm bytecode:check, then restore in finally.\n${result.stdout}${result.stderr}\nexit=${String(result.status)}\n`,
  );
  if (result.status === 0 || !(result.stdout + result.stderr).includes('BYTECODE_DIVERGED'))
    throw new Error('DIVERGENCE_CONTROL_FAILED');
  console.log('M11 negative control: bytecode gate rejects a changed limit. Source restored.');
} finally {
  writeFileSync(sourceFile, source);
}
for (const args of [['gate'], ['-C', 'apps/web', 'build']]) {
  const result = spawnSync('pnpm', args, { cwd: root, encoding: 'utf8', maxBuffer: 16000000 });
  appendFileSync(file, `\n$ pnpm ${args.join(' ')}\n${result.stdout}${result.stderr}\nexit=${String(result.status)}\n`);
  console.log(`pnpm ${args.join(' ')}: exit=${String(result.status)}; full output evidence/m11-checks.txt`);
  if (result.status !== 0) {
    process.exitCode = 1;
    break;
  }
}
