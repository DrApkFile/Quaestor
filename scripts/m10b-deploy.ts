import { readFileSync, readdirSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const origin = 'https://use-quaestor.vercel.app';
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const entry = (html: string) => html.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
const localEntry = entry(readFileSync(new URL('apps/web/dist/index.html', root), 'utf8'));
if (!localEntry) throw new Error('LOCAL_BUILD_ENTRY_REQUIRED');
const marker = 'Open window and continue';
const names = readdirSync(new URL('apps/web/dist/assets/', root)).filter((name) => name.endsWith('.js'));
const modalName = names.find((name) =>
  readFileSync(new URL(`apps/web/dist/assets/${name}`, root), 'utf8').includes(marker),
);
if (!modalName) throw new Error('LOCAL_MODAL_BUNDLE_REQUIRED');
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const localModalHash = sha256(readFileSync(new URL(`apps/web/dist/assets/${modalName}`, root), 'utf8'));
const target = new URL('evidence/m10b-deploy.json', root);
if (existsSync(target)) copyFileSync(target, new URL(`evidence/m10b-deploy-attempt-${String(Date.now())}.json`, root));
const checks: { path: string; status: number; matchesLocal: boolean; containsModal?: boolean; sha256?: string }[] = [];
let failure: string | null = null;
try {
  const htmlResponse = await fetch(`${origin}/app?commit=${commit}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });
  const html = await htmlResponse.text();
  checks.push({ path: '/app', status: htmlResponse.status, matchesLocal: entry(html) === localEntry });
  const modalResponse = await fetch(`${origin}/assets/${modalName}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });
  const modal = await modalResponse.text();
  checks.push({
    path: `/assets/${modalName}`,
    status: modalResponse.status,
    matchesLocal: sha256(modal) === localModalHash,
    containsModal: modal.includes(marker),
    sha256: sha256(modal),
  });
} catch {
  failure = 'DEPLOYMENT_READ_UNAVAILABLE';
}
const status =
  failure === null &&
  checks.length === 2 &&
  checks.every((check) => check.status === 200 && check.matchesLocal && check.containsModal !== false)
    ? 'PASSED'
    : 'FAILED';
writeFileSync(
  target,
  JSON.stringify(
    {
      command: 'pnpm evidence --m10b-deploy',
      commit,
      at: new Date().toISOString(),
      origin,
      status,
      failure,
      localEntry,
      localModalHash,
      marker,
      checks,
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify({ status, commit, checks, failure }));
if (status !== 'PASSED') process.exitCode = 1;
