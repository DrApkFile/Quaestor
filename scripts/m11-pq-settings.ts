import { z } from 'zod';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { relative, dirname, join } from 'node:path';
const root = new URL('../', import.meta.url);
const req = createRequire(new URL('../apps/web/package.json', import.meta.url));
const sdk = req.resolve('@qorechain/sdk').replace(/index\.cjs$/, 'index.js');
const sign = req.resolve('@qorechain/qoresign');
const seal = req.resolve('@qorechain/qoreseal');
const sealRequire = createRequire(seal);
const cardSign = sealRequire.resolve('@qorechain/qoresign');
const pqc = createRequire(sdk).resolve('@qorechain/pqc');
const noble = createRequire(pqc).resolve('@noble/post-quantum/ml-dsa.js');
const files: [string, string, number, number][] = [
  ['sdk-close', sdk, 18410, 18440],
  ['sdk-hybrid', sdk, 22109, 22152],
  ['sdk-domain', sdk, 18702, 18752],
  ['record-sign', join(dirname(sign), 'chunk-CC36VDKC.js'), 789, 835],
  ['record-pq', join(dirname(sign), 'chunk-CC36VDKC.js'), 418, 425],
  ['card-sign', join(dirname(seal), 'chunk-NSORPEVS.js'), 12, 85],
  ['card-qoresign', join(dirname(cardSign), 'chunk-GMJLZUVP.js'), 747, 790],
  ['card-pq', join(dirname(cardSign), 'chunk-GMJLZUVP.js'), 418, 425],
  ['pqc', pqc, 1, 80],
  ['noble-dsa', noble, 640, 692],
  ['noble-context', join(dirname(noble), 'utils.js'), 396, 420],
  ['noble-kem', join(dirname(noble), 'ml-kem.js'), 309, 409],
  ['seal-kem', join(dirname(seal), 'chunk-BDY7SXJP.js'), 193, 210],
];
const sources = files.map(([id, file, start, end]) => {
  const source = readFileSync(file, 'utf8');
  return {
    id,
    file: relative(new URL(root).pathname, realpathSync(file)),
    sha256: createHash('sha256').update(source).digest('hex'),
    start,
    end,
    excerpt: source
      .split('\n')
      .slice(start - 1, end)
      .map((line, index) => `${String(start + index)}: ${line}`)
      .join('\n'),
  };
});
const versions = [sdk, sign, seal, cardSign, pqc, noble].map((entry) => {
  let folder = dirname(entry);
  for (;;) {
    try {
      const content = readFileSync(join(folder, 'package.json'), 'utf8');
      const value = z.object({ name: z.string(), version: z.string() }).parse(JSON.parse(content) as unknown);
      return {
        name: value.name,
        version: value.version,
        file: relative(new URL(root).pathname, realpathSync(join(folder, 'package.json'))),
      };
    } catch {}
    const parent = dirname(folder);
    if (folder === parent) throw new Error('PACKAGE_VERSION_MISSING');
    folder = parent;
  }
});
writeFileSync(
  new URL('evidence/m11-pq-settings.json', root),
  JSON.stringify(
    {
      command: 'pnpm evidence --m11-pq-settings',
      at: new Date().toISOString(),
      versions,
      sources,
      limits:
        'Source inspection of installed implementations, not FIPS validation or a chain-node implementation audit.',
    },
    null,
    2,
  ) + '\n',
);
console.log('M11 PQ settings: six resolved dependency versions and thirteen line-numbered source excerpts recorded.');
