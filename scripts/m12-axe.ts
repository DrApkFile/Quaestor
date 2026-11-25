import { spawnSync } from 'node:child_process';
import { existsSync, copyFileSync, writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const report = new URL('evidence/m12-axe.json', root);
if (existsSync(report)) copyFileSync(report, new URL(`evidence/m12-axe-attempt-${String(Date.now())}.json`, root));
const result = spawnSync(
  'pnpm',
  ['-C', 'apps/web', 'exec', 'playwright', 'test', '--config=playwright.m9.config.ts', 'm12Axe.spec.ts'],
  { cwd: root, encoding: 'utf8', maxBuffer: 16000000 },
);
writeFileSync(
  new URL(`evidence/m12-axe-run-${String(Date.now())}.txt`, root),
  `${result.stdout}${result.stderr}\nexit=${String(result.status)}\n`,
);
console.log(result.stdout + result.stderr);
if (result.status !== 0) process.exitCode = 1;
