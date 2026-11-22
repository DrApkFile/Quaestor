import { existsSync, readFileSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { m7Command } from './m7-command.js';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { encryptVault } from '../apps/web/src/vault.js';
import { demoAuditorPassphrase } from '../apps/web/src/demo.js';
const root = new URL('../', import.meta.url),
  directory = new URL('.accounts/m7-browser/', root);
mkdirSync(new URL('tmp/', directory), { recursive: true, mode: 0o700 });
const path = new URL('fixtures.json', directory);
const names = ['client', 'business', 'supplier1', 'supplier2', 'auditor'] as const;
const secrets: string[] = [];
if (!existsSync(path)) {
  const password = randomBytes(32).toString('hex'),
    roles: Record<string, { backup: string; address: string }> = {};
  for (const name of names) {
    const account = z
      .object({ mnemonic: z.string(), cosmos: z.string() })
      .passthrough()
      .parse(JSON.parse(readFileSync(new URL(`.accounts/${name}.json`, root), 'utf8')) as unknown);
    const backup = new URL(`${name}.json`, directory);
    writeFileSync(backup, JSON.stringify(await encryptVault(account.mnemonic, password)), { mode: 0o600 });
    roles[name] = { backup: backup.pathname, address: account.cosmos };
    if (name === 'auditor')
      writeFileSync(
        new URL('apps/web/public/demo-auditor.json', root),
        JSON.stringify(await encryptVault(account.mnemonic, demoAuditorPassphrase)) + '\n',
      );
  }
  const previous = z
    .object({
      client: z.object({ payments: z.array(z.object({ direction: z.string() }).passthrough()) }).passthrough(),
      business: z
        .object({
          payments: z.array(z.object({ direction: z.string() }).passthrough()),
          books: z.array(z.object({ id: z.string() }).passthrough()),
        })
        .passthrough(),
    })
    .passthrough()
    .parse(JSON.parse(readFileSync(new URL('evidence/m6-browser.json', root), 'utf8')) as unknown);
  writeFileSync(
    new URL('plan.json', directory),
    JSON.stringify({
      client: previous.client.payments.filter((p) => p.direction === 'OUT').length,
      business: previous.business.payments.filter((p) => p.direction === 'OUT').length,
      oldBooks: previous.business.books.map((b) => b.id),
    }),
    { mode: 0o600 },
  );
  for (const name of ['client', 'business', 'other'])
    copyFileSync(new URL(`.accounts/m6-browser/${name}-state.json`, root), new URL(`${name}-state.json`, directory));
  writeFileSync(
    path,
    JSON.stringify({
      password,
      label: 'Northwind Studio (demo)',
      roles,
      canaries: ['counterparty', 'purpose', 'notes', 'invoice'].map(
        (label) => `${label}-${randomBytes(16).toString('hex')}`,
      ),
    }),
    { mode: 0o600 },
  );
}
const fixture = z
  .object({ password: z.string(), canaries: z.array(z.string()) })
  .passthrough()
  .parse(JSON.parse(readFileSync(path, 'utf8')) as unknown);
secrets.push(fixture.password, ...fixture.canaries);
for (const name of names)
  secrets.push(
    z
      .object({ mnemonic: z.string() })
      .passthrough()
      .parse(JSON.parse(readFileSync(new URL(`.accounts/${name}.json`, root), 'utf8')) as unknown).mnemonic,
  );
if (process.env.QUAESTOR_M7_PREPARE_ONLY === '1') {
  console.log('Prepared encrypted M7 fixtures; no chain transactions.');
  process.exit(0);
}
const { fundM7 } = await import('./m7-funding.js');
await fundM7('client', '5000000');
await fundM7('business', '10000000');
const recheck = process.env.QUAESTOR_M7_RECHECK_BROWSER === '1';
if (
  recheck &&
  existsSync(new URL('evidence/m7-browser.json', root)) &&
  !existsSync(new URL('evidence/m7-browser-initial.json', root))
)
  copyFileSync(new URL('evidence/m7-browser.json', root), new URL('evidence/m7-browser-initial.json', root));
if (recheck || !existsSync(new URL('evidence/m7-browser.json', root))) {
  if (m7Command('build-before', ['-C', 'apps/web', 'build'], path.pathname, secrets) !== 0) process.exit(1);
  if (m7Command('run', ['-C', 'apps/web', 'exec', 'playwright', 'test', 'm7.spec.ts'], path.pathname, secrets) !== 0)
    process.exit(1);
} else console.log('M7 browser journey already passed; reusing its checkpointed evidence.');
const { duplicateM7 } = await import('../packages/chain/scripts/m7Duplicate.js');
await duplicateM7();
if (m7Command('build-final', ['-C', 'apps/web', 'build'], path.pathname, secrets) !== 0) process.exit(1);
process.exitCode = m7Command(
  'attack',
  ['-C', 'apps/web', 'exec', 'playwright', 'test', 'm7Attack.spec.ts'],
  path.pathname,
  secrets,
);
if (process.exitCode === 0)
  console.log('M7 PASSED: browser journey, backup, B-only grant, and read-only anchored attack cases.');
