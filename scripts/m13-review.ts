import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { z } from 'zod';
import { chromium } from '@playwright/test';
const root = new URL('../', import.meta.url);
const origin = 'https://use-quaestor.vercel.app';
const links = [];
for (const file of ['README.md', 'JUDGES.md']) {
  const body = readFileSync(new URL(file, root), 'utf8');
  for (const match of body.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (!target) throw new Error('LINK_TARGET_MISSING');
    if (/^https?:/.test(target)) {
      links.push({ file, target, kind: 'external', exists: null });
      continue;
    }
    const [path, fragment] = target.split('#');
    const destination = resolve(root.pathname, dirname(file), decodeURIComponent(path || file));
    const exists = existsSync(destination);
    const anchorExists =
      !fragment ||
      (exists &&
        readFileSync(destination, 'utf8')
          .split('\n')
          .filter((line) => /^#+ /.test(line))
          .some(
            (line) =>
              line
                .replace(/^#+ /, '')
                .toLowerCase()
                .replace(/[^\p{L}\p{N}\s_-]/gu, '')
                .replace(/\s/g, '-') === fragment,
          ));
    links.push({ file, target, kind: 'repository', exists: exists && anchorExists });
  }
}
const externalChecks = [];
for (const target of new Set(links.filter((link) => link.kind === 'external').map((link) => link.target))) {
  const response = await fetch(target, { signal: AbortSignal.timeout(60000) });
  externalChecks.push({ target, status: response.status, finalUrl: response.url });
  await response.body?.cancel();
}
const browser = await chromium.launch({ headless: true });
const routes = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**/*', async (route) => {
    if (/eth_sendRawTransaction|broadcast_tx|\/cosmos\/tx\/v1beta1\/txs/.test(route.request().postData() ?? ''))
      throw new Error('UNEXPECTED_BROADCAST');
    await route.continue();
  });
  for (const [path, expected] of [
    ['/', 'Try the demo auditor'],
    ['/app', 'Account'],
    ['/attack-lab', 'Read attack book from chain'],
  ] as const) {
    const response = await page.goto(origin + path, { waitUntil: 'networkidle', timeout: 60000 });
    await page.getByText(expected, { exact: false }).first().waitFor();
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    routes.push({ path, status: response?.status(), expected, visible: true, fits });
  }
} finally {
  await browser.close();
}
const labels = [
  'Deposit amount',
  'Payment amount',
  'Recipient qor1 address',
  'Matches a real payment',
  'Holdings cover the books',
  'Not shared with you',
  'Activate quantum-safe account',
  'Ready for private payments',
  'Details',
  'Transaction details',
  'Deposit privately',
  'Prove and pay',
  'Open window and continue',
  'Proof details',
  'Check chain',
  'Securing your account with a quantum-safe signature (1/3)',
  'Publishing your quantum-safe encryption key, so people can pay you privately (2/3)',
  'Publishing your payment card (3/3)',
];
const directory = new URL('apps/web/dist/assets/', root);
const bundles = readdirSync(directory)
  .filter((name) => name.endsWith('.js'))
  .map((name) => ({ name, text: readFileSync(new URL(name, directory), 'utf8') }));
const labelChecks = [];
for (const label of labels) {
  const bundle = bundles.find((item) => item.text.includes(label));
  if (!bundle) throw new Error(`LOCAL_LABEL_NOT_FOUND:${label}`);
  const response = await fetch(`${origin}/assets/${bundle.name}`, { signal: AbortSignal.timeout(30000) });
  const deployed = await response.text();
  const sha = (value: string) => createHash('sha256').update(value).digest('hex');
  labelChecks.push({
    label,
    bundle: bundle.name,
    status: response.status,
    byteIdentical: sha(deployed) === sha(bundle.text),
    sha256: sha(deployed),
  });
}
const metadataResponse = await fetch('https://api.github.com/repos/DrApkFile/Quaestor', {
  signal: AbortSignal.timeout(30000),
});
if (!metadataResponse.ok) throw new Error('REPOSITORY_METADATA_FAILED');
const metadata = z.object({ description: z.string(), html_url: z.string().url() }).parse(await metadataResponse.json());
const passed =
  links.every((link) => link.exists !== false) &&
  externalChecks.every((check) => check.status === 200) &&
  routes.every((route) => route.status === 200 && route.fits) &&
  labelChecks.every((check) => check.status === 200 && check.byteIdentical);
const report = {
  command: 'pnpm evidence --m13-review',
  at: new Date().toISOString(),
  origin,
  links,
  externalChecks,
  routes,
  labelChecks,
  metadata,
  status: passed ? 'PASSED' : 'FAILED',
  scope:
    'Local Markdown file and heading links checked; external URLs fetched. Three production routes rendered at 390px. Account/payment labels checked against byte-identical deployed JavaScript without account creation or broadcasts.',
};
writeFileSync(new URL('evidence/m13-review.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(
  `M13 review ${report.status}: ${links.length} links, ${routes.length} routes, ${labelChecks.length} deployed labels.`,
);
if (!passed) process.exitCode = 1;
