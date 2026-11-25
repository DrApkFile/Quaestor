import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { z } from 'zod';
const root = new URL('../', import.meta.url),
  origin = 'https://use-quaestor.vercel.app';
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const entry = (html: string) => html.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
const localEntry = entry(readFileSync(new URL('apps/web/dist/index.html', root), 'utf8'));
if (!localEntry) throw new Error('LOCAL_BUILD_REQUIRED');
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const assets = readdirSync(new URL('apps/web/dist/assets/', root)).filter((name) => name.endsWith('.js'));
const changedBundles = assets.filter((name) =>
  /hedged:!0/.test(readFileSync(new URL(`apps/web/dist/assets/${name}`, root), 'utf8')),
);
const landmarkBundle = assets.find((name) => {
  const text = readFileSync(new URL(`apps/web/dist/assets/${name}`, root), 'utf8');
  return (
    text.includes('Swipe navigation to see all areas') &&
    /[`"']main[`"'],\{children:\[.{0,100}className:[`"']nav-hint/.test(text)
  );
});
if (changedBundles.length < 2 || !landmarkBundle) throw new Error('LOCAL_CHANGE_MARKERS_REQUIRED');
const statusResponse = await fetch(`https://api.github.com/repos/DrApkFile/Quaestor/commits/${commit}/status`, {
  headers: { Accept: 'application/vnd.github+json' },
  signal: AbortSignal.timeout(30000),
});
if (!statusResponse.ok) throw new Error('COMMIT_DEPLOYMENT_STATUS_UNAVAILABLE');
const deploymentStatus = z
  .object({
    sha: z.string(),
    state: z.string(),
    statuses: z.array(
      z.object({ context: z.string(), state: z.string(), target_url: z.string().nullable() }).passthrough(),
    ),
  })
  .passthrough()
  .parse((await statusResponse.json()) as unknown);
const vercel = deploymentStatus.statuses.find((status) => status.context === 'Vercel');
if (deploymentStatus.sha !== commit || vercel?.state !== 'success') throw new Error('COMMIT_DEPLOYMENT_NOT_LIVE');
const html = await fetch(`${origin}/app?commit=${commit}`, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
const deployedEntry = entry(await html.text());
const checks = [];
for (const name of new Set([...changedBundles, landmarkBundle, localEntry.split('/').at(-1)])) {
  if (!name) throw new Error('ENTRY_NAME_REQUIRED');
  const response = await fetch(`${origin}/assets/${name}`, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
  const text = await response.text(),
    local = readFileSync(new URL(`apps/web/dist/assets/${name}`, root), 'utf8');
  checks.push({
    path: `/assets/${name}`,
    status: response.status,
    matchesLocal: sha256(text) === sha256(local),
    sha256: sha256(text),
    hedgedMarker: /hedged:!0/.test(text),
    landmarkMarker: name === landmarkBundle && /[`"']main[`"'],\{children:\[.{0,100}className:[`"']nav-hint/.test(text),
  });
}
const passed =
  html.status === 200 &&
  deployedEntry === localEntry &&
  checks.every((check) => check.status === 200 && check.matchesLocal);
const report = {
  command: 'pnpm evidence --m12-deploy',
  commit,
  at: new Date().toISOString(),
  origin,
  status: passed ? 'PASSED' : 'FAILED',
  deploymentStatus: { sha: deploymentStatus.sha, vercel },
  localEntry,
  deployedEntry,
  changedBundles,
  landmarkBundle,
  checks,
  attribution:
    'Production entry and every changed bundle match the local build byte-for-byte; commit deployment status is checked through GitHub.',
};
console.log(JSON.stringify(report));
if (!passed) process.exitCode = 1;
