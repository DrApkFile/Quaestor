import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, copyFileSync, writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url),
  file = new URL('evidence/m13-checks.txt', root);
if (existsSync(file)) copyFileSync(file, new URL(`evidence/m13-checks-attempt-${String(Date.now())}.txt`, root));
writeFileSync(
  file,
  `Command: pnpm evidence --m13-checks\nCommit: ${execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()}\n`,
);
for (const args of [['gate'], ['-C', 'apps/web', 'build']]) {
  const result = spawnSync('pnpm', args, { cwd: root, encoding: 'utf8', maxBuffer: 16000000 });
  appendFileSync(file, `\n$ pnpm ${args.join(' ')}\n${result.stdout}${result.stderr}\nexit=${String(result.status)}\n`);
  console.log(`pnpm ${args.join(' ')}: exit=${String(result.status)}; full output evidence/m13-checks.txt`);
  if (result.status !== 0) {
    process.exitCode = 1;
    break;
  }
}
