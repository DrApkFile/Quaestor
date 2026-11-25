import { spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, writeFileSync } from 'node:fs';
const run = process.argv[2] === '--m10b-checks' ? 'm10b' : 'm10';
const root = new URL('../', import.meta.url),
  file = new URL(`../evidence/${run}-checks.txt`, import.meta.url);
if (existsSync(file))
  copyFileSync(file, new URL(`../evidence/${run}-checks-attempt-${String(Date.now())}.txt`, import.meta.url));
writeFileSync(file, `Command: pnpm evidence --${run}-checks\nStarted: ${new Date().toISOString()}\n`);
for (const args of [['gate'], ['-C', 'apps/web', 'build']]) {
  const command = `pnpm ${args.join(' ')}`;
  const result = spawnSync('pnpm', args, { cwd: root, encoding: 'utf8', maxBuffer: 16000000 });
  appendFileSync(file, `\n$ ${command}\n${result.stdout}${result.stderr}\nexit=${String(result.status)}\n`);
  console.log(`${command}: exit=${String(result.status)}; full output evidence/${run}-checks.txt`);
  if (result.status !== 0) {
    process.exitCode = 1;
    break;
  }
}
