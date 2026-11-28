import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const secrets = new Set<string>();
const collect = (value: unknown, name = '') => {
  if (
    typeof value === 'string' &&
    /^(mnemonic|privateKey|secretKey|secret|epochKey|password)$/.test(name) &&
    value.length > 20
  )
    secrets.add(value);
  if (Array.isArray(value)) {
    if (
      /^(secretKey|mlkemSecretKey|x25519SecretKey|seed|key)$/.test(name) &&
      value.length >= 32 &&
      value.every((item) => Number.isInteger(item) && Number(item) >= 0 && Number(item) <= 255)
    ) {
      const bytes = Buffer.from(value as number[]);
      secrets.add(bytes.toString('hex'));
      secrets.add(bytes.toString('base64'));
    }
    for (const item of value as unknown[]) collect(item);
  } else if (typeof value === 'object' && value !== null)
    for (const [key, item] of Object.entries(value)) collect(item, key);
};
const walk = (directory: URL) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory() && !/^(bin|lib|lib64|include|share|__pycache__|site-packages)$/.test(entry.name))
      walk(file);
    else if (entry.isFile() && entry.name.endsWith('.json') && statSync(file).size < 16000000) {
      const value: unknown = JSON.parse(readFileSync(file, 'utf8'));
      if (entry.name === 'scan-secrets.json' && Array.isArray(value))
        for (const item of value as unknown[]) {
          if (typeof item === 'string' && item.length > 20) secrets.add(item);
        }
      else collect(value);
    }
  }
};
walk(new URL('.accounts/', root));
for (const secret of [...secrets]) {
  secrets.add(Buffer.from(secret).toString('base64'));
  secrets.add(Buffer.from(secret).toString('hex'));
  secrets.add(encodeURIComponent(secret));
  if (/^0x[\da-f]{64}$/i.test(secret)) secrets.add(secret.slice(2));
}
const files = [
  ...new Set([
    ...execFileSync('git', ['diff', '--name-only', '9e0c54270bb9befc2618b1dc91d4f2b37d5ea30b'], {
      cwd: root,
      encoding: 'utf8',
    })
      .trim()
      .split('\n'),
    ...execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
      .trim()
      .split('\n'),
  ]),
].filter(Boolean);
const matches = files.filter((file) => {
  const text = readFileSync(new URL(file, root), 'utf8');
  return [...secrets].some((secret) => text.includes(secret));
});
const report = {
  command: 'pnpm evidence --m13-secret-scan',
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  at: new Date().toISOString(),
  status: matches.length === 0 ? 'PASSED' : 'FAILED',
  filesScanned: files.length,
  filesWithKnownSecretMatches: matches.length,
  matchedFiles: matches,
  scope:
    'Changed and new files against locally collected known secrets and encodings; no universal secret-detection claim.',
};
writeFileSync(new URL('evidence/m13-secret-scan.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
if (matches.length) process.exitCode = 1;
