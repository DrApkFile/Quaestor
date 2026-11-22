import { spawnSync } from 'node:child_process';
import { imageScanSecrets } from './m8Secrets.js';
await imageScanSecrets();
const result = spawnSync('python3', [new URL('m8-repo-scan.py', import.meta.url).pathname], {
  cwd: new URL('../', import.meta.url),
  stdio: 'inherit',
});
process.exitCode = result.status ?? 1;
