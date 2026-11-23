import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { z } from 'zod';
const phase = z.enum(['before', 'after']).parse(process.argv[3]);
const target = new URL('../evidence/m9-bundles.json', import.meta.url);
const prior: unknown = existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) : {};
const record = z.record(z.unknown()).parse(prior);
const directory = new URL('../apps/web/dist/assets/', import.meta.url);
const assets = readdirSync(directory)
  .filter((name) => /\.(js|css)$/.test(name))
  .map((name) => {
    const bytes = readFileSync(new URL(name, directory));
    return { name, bytes: bytes.length, gzipBytes: gzipSync(bytes).length };
  });
record[phase] = {
  at: new Date().toISOString(),
  assets,
  totalBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
  totalGzipBytes: assets.reduce((sum, asset) => sum + asset.gzipBytes, 0),
};
writeFileSync(
  target,
  JSON.stringify(
    {
      ...record,
      command: `pnpm evidence --m9-bundles ${phase}`,
      limits:
        'Total output includes lazy chunks; per-page transferred JavaScript is recorded separately in m9-judge reports.',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `${phase}: ${String(assets.length)} assets; ${String(assets.reduce((sum, asset) => sum + asset.bytes, 0))} bytes total`,
);
