import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
const origin = 'https://use-quaestor.vercel.app';
const checks = [
  { path: '/app', head: true, expected: 200 },
  { path: '/attack-lab', head: true, expected: 200 },
  {
    path: '/api/qore/rest/qorechain/pqc/v1/kem/qor1u5lhadlcp5wqf2h3yds2jclqc4q4dyacqugkqp',
    head: false,
    expected: 200,
  },
  { path: '/api/qore/rest/not-allowlisted', head: false, expected: 400 },
].map(({ path, head, expected }) => {
  const args = [head ? '-I' : '-i', '--max-time', '45', `${origin}${path}`];
  const result = spawnSync('curl', args, { encoding: 'utf8' });
  const output = result.stdout;
  const statuses = [...output.matchAll(/^HTTP\/\S+ (\d+)/gm)];
  const status = Number(statuses.at(-1)?.[1] ?? 0);
  const headers = [
    'content-security-policy',
    'x-content-type-options',
    'referrer-policy',
    'permissions-policy',
    'strict-transport-security',
  ];
  const missingHeaders = headers.filter((name) => !new RegExp(`^${name}:`, 'im').test(output));
  let registryValid = true;
  if (path.includes('/kem/')) {
    try {
      const body: unknown = JSON.parse(output.split('\r\n\r\n').at(-1) ?? '');
      registryValid = z
        .object({
          found: z.literal(true),
          key: z
            .object({ algorithm_id: z.literal(2), address: z.literal('qor1u5lhadlcp5wqf2h3yds2jclqc4q4dyacqugkqp') })
            .passthrough(),
        })
        .passthrough()
        .safeParse(body).success;
    } catch {
      registryValid = false;
    }
  }
  const valid =
    registryValid &&
    result.status === 0 &&
    status === expected &&
    missingHeaders.length === 0 &&
    (head || (/content-type: application\/json/i.test(output) && !output.includes('<!doctype html>'))) &&
    (expected !== 400 || output.includes('QORE_RELAY_REFUSED'));
  return {
    command: `curl ${args.join(' ')}`,
    exit: result.status,
    output,
    stderr: result.stderr,
    status,
    expected,
    missingHeaders,
    valid,
  };
});
const status = checks.every((check) => check.valid) ? 'PASSED' : 'FAILED';
const target = new URL('../evidence/m9-deploy.json', import.meta.url);
if (existsSync(target))
  copyFileSync(target, new URL(`../evidence/m9-deploy-attempt-${String(Date.now())}.json`, import.meta.url));
writeFileSync(
  new URL('../evidence/m9-deploy.json', import.meta.url),
  JSON.stringify({ command: 'pnpm evidence --m9-deploy', at: new Date().toISOString(), status, checks }, null, 2) +
    '\n',
);
console.log(
  JSON.stringify({
    status,
    checks: checks.map(({ status, valid, missingHeaders }) => ({ status, valid, missingHeaders })),
  }),
);
if (status !== 'PASSED') process.exitCode = 1;
