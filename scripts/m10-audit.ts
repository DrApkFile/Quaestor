import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
const root = new URL('../', import.meta.url);
const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
if (git.status !== 0) throw new Error('COMMIT_REQUIRED');
const deployment = z
  .object({ books: z.object({ address: z.string() }), board: z.object({ address: z.string() }) })
  .parse(JSON.parse(readFileSync(new URL('config/m5.json', root), 'utf8')) as unknown);
mkdirSync(new URL('docs/audit/', root), { recursive: true });
const results = [];
for (const [name, address] of [
  ['Books', deployment.books.address],
  ['BlobBoard', deployment.board.address],
] as const) {
  const command = ['flatten', `src/${name}.sol`];
  const flattened = spawnSync('forge', command, { cwd: new URL('contracts/', root), encoding: 'utf8' });
  if (flattened.status !== 0) throw new Error('FLATTEN_FAILED');
  const header = `// Source git commit: ${git.stdout.trim()}\n// Diana (qorechain-diana, EVM 9800): ${address}\n// File SHA-256 (this field normalized to 64 zeros): ${'0'.repeat(64)}\n`;
  const normalized = header + flattened.stdout;
  const hash = createHash('sha256').update(normalized).digest('hex');
  const source = normalized.replace('0'.repeat(64), hash);
  const file = `docs/audit/${name}.flat.sol`;
  writeFileSync(new URL(file, root), source);
  const temp = mkdtempSync(join(tmpdir(), 'quaestor-audit-'));
  mkdirSync(join(temp, 'src'));
  writeFileSync(join(temp, 'src', `${name}.sol`), source);
  const args = [
    'build',
    '--root',
    temp,
    '--use',
    '0.8.24',
    '--evm-version',
    'shanghai',
    '--optimize',
    '--optimizer-runs',
    '200',
  ];
  const compiled = spawnSync('forge', args, { encoding: 'utf8' });
  results.push({
    file,
    address,
    sourceCommit: git.stdout.trim(),
    normalizedSha256: hash,
    sha256: createHash('sha256').update(source).digest('hex'),
    flattenCommand: `forge ${command.join(' ')}`,
    compileCommand: `forge ${args.join(' ')}`,
    stdout: compiled.stdout,
    stderr: compiled.stderr,
    exit: compiled.status,
  });
}
writeFileSync(
  new URL('evidence/m10-audit.json', root),
  JSON.stringify({ command: 'pnpm evidence --m10-audit', results }, null, 2) + '\n',
);
for (const result of results)
  console.log(`${result.file}: solc 0.8.24 isolated compile exit=${String(result.exit)}; SHA-256 ${result.sha256}`);
if (results.some((result) => result.exit !== 0)) process.exitCode = 1;
