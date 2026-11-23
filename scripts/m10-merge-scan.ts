import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { mergeImageReports } from './m9-image-reports.js';
const root = new URL('../', import.meta.url);
const parts: unknown[] = [0, 1].map(
  (part) =>
    JSON.parse(
      readFileSync(new URL(`evidence/m10-image-secret-scan-part${String(part)}.json`, root), 'utf8'),
    ) as unknown,
);
const expected = readdirSync(new URL('evidence/m10-screens/', root))
  .filter((name) => name.endsWith('.png'))
  .map((name) => ({
    file: `evidence/m10-screens/${name}`,
    sha256: createHash('sha256')
      .update(readFileSync(new URL(`evidence/m10-screens/${name}`, root)))
      .digest('hex'),
  }));
const report = {
  ...mergeImageReports(parts, expected),
  command: 'pnpm evidence --m10-secret-scan --merge-completed',
  scanCommand: 'pnpm evidence --m10-secret-scan',
};
const target = new URL('evidence/m10-image-secret-scan.json', root);
if (existsSync(target))
  copyFileSync(target, new URL(`evidence/m10-image-secret-scan-attempt-${String(Date.now())}.json`, root));
writeFileSync(target, JSON.stringify(report, null, 2) + '\n');
console.log(`M10 screenshot scan PASSED: ${String(report.images.length)} images; every current image hash checked.`);
