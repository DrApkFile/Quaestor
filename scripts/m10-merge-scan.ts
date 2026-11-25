import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { mergeImageReports } from './m9-image-reports.js';
const run = process.argv[2] === '--m10b-secret-scan' ? 'm10b' : 'm10';
const root = new URL('../', import.meta.url);
const parts: unknown[] = [0, 1].map(
  (part) =>
    JSON.parse(
      readFileSync(new URL(`evidence/${run}-image-secret-scan-part${String(part)}.json`, root), 'utf8'),
    ) as unknown,
);
const expected = readdirSync(new URL(`evidence/${run}-screens/`, root))
  .filter((name) => name.endsWith('.png'))
  .map((name) => ({
    file: `evidence/${run}-screens/${name}`,
    sha256: createHash('sha256')
      .update(readFileSync(new URL(`evidence/${run}-screens/${name}`, root)))
      .digest('hex'),
  }));
const report = {
  ...mergeImageReports(parts, expected),
  command: `pnpm evidence --${run}-secret-scan --merge-completed`,
  scanCommand: `pnpm evidence --${run}-secret-scan`,
};
const target = new URL(`evidence/${run}-image-secret-scan.json`, root);
if (existsSync(target))
  copyFileSync(target, new URL(`evidence/${run}-image-secret-scan-attempt-${String(Date.now())}.json`, root));
writeFileSync(target, JSON.stringify(report, null, 2) + '\n');
console.log(
  `${run.toUpperCase()} screenshot scan PASSED: ${String(report.images.length)} images; every current image hash checked.`,
);
