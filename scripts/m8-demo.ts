import { existsSync, readFileSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { z } from 'zod';
import { m7Command } from './m7-command.js';
import { imageScanSecrets } from './m8Secrets.js';
import { fundM7 } from './m7-funding.js';
const run = z.enum(['m7b', 'm8-privacy']).parse(process.argv[2]?.slice(2));
process.env.QUAESTOR_DEMO_RUN = run;
if (run === 'm7b') {
  z.object({ status: z.literal('PASSED'), label: z.literal('Privacy test (demo)') })
    .passthrough()
    .parse(
      JSON.parse(readFileSync(new URL('../evidence/m8-privacy-browser.json', import.meta.url), 'utf8')) as unknown,
    );
}
const root = new URL('../', import.meta.url),
  directory = new URL(`.accounts/${run}-browser/`, root);
mkdirSync(new URL('tmp/', directory), { recursive: true, mode: 0o700 });
mkdirSync(new URL(`evidence/${run}-screens/`, root), { recursive: true });
const path = new URL('fixtures.json', directory);
if (!existsSync(path)) {
  const source = new URL(`.accounts/${run === 'm7b' ? 'm8-privacy' : 'm7'}-browser/`, root);
  const fixture = z
    .object({ password: z.string(), canaries: z.array(z.string()), label: z.string() })
    .passthrough()
    .parse(JSON.parse(readFileSync(new URL('fixtures.json', source), 'utf8')) as unknown);
  writeFileSync(
    path,
    JSON.stringify({
      ...fixture,
      label: run === 'm7b' ? 'Northwind Studio (demo)' : 'Privacy test (demo)',
      publicDemo: run === 'm7b',
    }),
    { mode: 0o600 },
  );
  for (const name of ['client', 'business', 'other'])
    copyFileSync(new URL(`${name}-state.json`, source), new URL(`${name}-state.json`, directory));
}
const fixture = z
  .object({ password: z.string(), canaries: z.array(z.string()) })
  .passthrough()
  .parse(JSON.parse(readFileSync(path, 'utf8')) as unknown);
const secrets = [fixture.password, ...fixture.canaries];
await fundM7('client', '10000000', run);
await fundM7('business', '15000000', run);
if (m7Command(`${run}-build`, ['-C', 'apps/web', 'build'], path.pathname, secrets) !== 0) process.exit(1);
if (!existsSync(new URL(`evidence/${run}-browser.json`, root))) {
  for (const spec of ['m8Prepare.spec.ts', 'm7.spec.ts'])
    if (
      m7Command(`${run}-${spec}`, ['-C', 'apps/web', 'exec', 'playwright', 'test', spec], path.pathname, secrets) !== 0
    )
      process.exit(1);
}
if (run === 'm7b') {
  const result = z
    .object({ bookId: z.string() })
    .passthrough()
    .parse(JSON.parse(readFileSync(new URL('evidence/m7b-browser.json', root), 'utf8')) as unknown);
  const old = z
    .object({ honest: z.string(), duplicate: z.string(), label: z.string() })
    .strict()
    .parse(JSON.parse(readFileSync(new URL('apps/web/public/m7-demo.json', root), 'utf8')) as unknown);
  writeFileSync(
    new URL('apps/web/public/m7-demo.json', root),
    JSON.stringify({ ...old, honest: result.bookId }, null, 2) + '\n',
  );
  writeFileSync(
    new URL('evidence/m7-runs.json', root),
    JSON.stringify(
      {
        command: 'pnpm evidence --m7b',
        runs: [
          {
            run: 'm7',
            label: 'superseded: canary content',
            book: '0x745c77ad45cf784d7a16e7ea12461f23ab9ea2d88a0f50bf6678262f76d6afc1',
            evidence: 'evidence/m7-browser-initial.json',
          },
          { run: 'm7b', label: 'Northwind Studio (demo)', book: result.bookId, evidence: 'evidence/m7b-browser.json' },
        ],
      },
      null,
      2,
    ) + '\n',
  );
  if (m7Command('m7b-final-build', ['-C', 'apps/web', 'build'], path.pathname, secrets) !== 0) process.exit(1);
  if (
    m7Command(
      'm7b-fresh',
      ['-C', 'apps/web', 'exec', 'playwright', 'test', 'm7Attack.spec.ts'],
      path.pathname,
      secrets,
    ) !== 0
  )
    process.exit(1);
  await imageScanSecrets();
  const scanResult = spawnSync(
    new URL('.accounts/m8-ocr/bin/python', root).pathname,
    [new URL('m8-image-scan.py', import.meta.url).pathname],
    {
      cwd: root,
      stdio: 'inherit',
    },
  );
  if (scanResult.status !== 0) process.exit(1);
}
console.log(`${run} PASSED: isolated book journey and evidence.`);
process.stdout.write('', () => process.exit(0));
