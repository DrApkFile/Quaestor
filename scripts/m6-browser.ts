import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { encryptVault } from '../apps/web/src/vault.js';
const root = new URL('../', import.meta.url),
  directory = new URL('.accounts/m6-browser/', root);
if (existsSync(new URL('evidence/m6-browser.json', root))) throw new Error('M6_RUN_ALREADY_EXISTS');
mkdirSync(directory, { recursive: true, mode: 0o700 });
const path = new URL('fixtures.json', directory);
const role = z.enum(['client', 'business', 'supplier1', 'supplier2', 'auditor']);
const schema = z
  .object({
    password: z.string(),
    label: z.string(),
    roles: z.record(z.object({ backup: z.string(), address: z.string() }).strict()),
    canaries: z.array(z.string()).length(4),
  })
  .strict();
const secrets: string[] = [];
if (!existsSync(path)) {
  const password = randomBytes(32).toString('hex'),
    roles: Record<string, { backup: string; address: string }> = {};
  for (const name of role.options) {
    const account = z
      .object({ mnemonic: z.string(), cosmos: z.string() })
      .passthrough()
      .parse(JSON.parse(readFileSync(new URL(`.accounts/${name}.json`, root), 'utf8')) as unknown);
    const backup = new URL(`${name}.json`, directory);
    writeFileSync(backup, JSON.stringify(await encryptVault(account.mnemonic, password)), { mode: 0o600 });
    roles[name] = { backup: backup.pathname, address: account.cosmos };
  }
  writeFileSync(
    path,
    JSON.stringify({
      password,
      label: `M6 browser ${new Date().toISOString().replaceAll(':', '-')}`,
      roles,
      canaries: ['counterparty', 'purpose', 'notes', 'invoice'].map(
        (label) => `${label}-${randomBytes(16).toString('hex')}`,
      ),
    }),
    { mode: 0o600 },
  );
}
const fixture = schema.parse(JSON.parse(readFileSync(path, 'utf8')) as unknown);
secrets.push(fixture.password, ...fixture.canaries);
for (const name of role.options) {
  const account = z
    .object({ mnemonic: z.string() })
    .passthrough()
    .parse(JSON.parse(readFileSync(new URL(`.accounts/${name}.json`, root), 'utf8')) as unknown);
  secrets.push(account.mnemonic);
}
const result = spawnSync('pnpm', ['-C', 'apps/web', 'exec', 'playwright', 'test', 'm6.spec.ts'], {
  cwd: root,
  env: { ...process.env, QUAESTOR_M6_FIXTURES: path.pathname },
  encoding: 'utf8',
  maxBuffer: 10000000,
});
const output = (result.stdout ?? '') + (result.stderr ?? '');
writeFileSync(new URL(`run-${Date.now()}.log`, directory), output, { mode: 0o600 });
let safe = output;
for (const secret of secrets) safe = safe.split(secret).join('[PRIVATE]');
console.log(safe);
process.exitCode = result.status ?? 1;
