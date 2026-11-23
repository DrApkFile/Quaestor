import { spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url),
  file = new URL('../evidence/m10-checks.txt', import.meta.url);
if (existsSync(file))
  copyFileSync(file, new URL(`../evidence/m10-checks-attempt-${String(Date.now())}.txt`, import.meta.url));
writeFileSync(file, `Command: pnpm evidence --m10-checks\nStarted: ${new Date().toISOString()}\n`);
for (const args of [['gate'], ['-C', 'apps/web', 'build']]) {
  const command = `pnpm ${args.join(' ')}`;
  const result = spawnSync('pnpm', args, { cwd: root, encoding: 'utf8', maxBuffer: 16000000 });
  appendFileSync(file, `\n$ ${command}\n${result.stdout}${result.stderr}\nexit=${String(result.status)}\n`);
  console.log(`${command}: exit=${String(result.status)}; full output evidence/m10-checks.txt`);
  if (result.status !== 0) {
    process.exitCode = 1;
    break;
  }
}
