import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { z } from 'zod';
import { encryptVault } from '../apps/web/src/vault.js';
const root = new URL('../', import.meta.url);
const account = z
  .object({ mnemonic: z.string() })
  .passthrough()
  .parse(JSON.parse(readFileSync(new URL('.accounts/auditor.json', root), 'utf8')) as unknown);
const folder = new URL('.accounts/m5-web/', root);
mkdirSync(folder, { recursive: true, mode: 0o700 });
const passphrase = randomBytes(32).toString('hex');
const backup = await encryptVault(account.mnemonic, passphrase);
const path = new URL('auditor-backup.json', folder);
writeFileSync(path, JSON.stringify(backup), { mode: 0o600 });
const start = performance.now();
const result = spawnSync('pnpm', ['-C', 'apps/web', 'test:e2e'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, QUAESTOR_AUDITOR_BACKUP: path.pathname, QUAESTOR_AUDITOR_PASSWORD: passphrase },
});
const evidence = {
  command: 'pnpm evidence --m5-web',
  at: new Date().toISOString(),
  status: result.status === 0 ? 'PASSED' : 'FAILED',
  elapsedMs: performance.now() - start,
  publicCheck: result.status === 0,
  auditorFromChain: result.status === 0,
  viewportWidths: [1440, 390],
  plaintextRequestLeaks: result.status === 0 ? 0 : null,
  source: 'production Vite preview with the Vercel CSP and same relay handler',
  backup: 'encrypted local fixture only; credentials excluded',
};
writeFileSync(new URL('evidence/m5-web.json', root), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
process.exitCode = result.status ?? 1;
