import { existsSync, readFileSync } from 'node:fs';
import { checkClaims } from './checkClaims.js';
const root = new URL('../', import.meta.url);
const read = (path: string) =>
  existsSync(new URL(path, root)) ? readFileSync(new URL(path, root), 'utf8') : undefined;
const errors = checkClaims(
  readFileSync(new URL('README.md', root), 'utf8'),
  readFileSync(new URL('CLAIMS.md', root), 'utf8'),
  JSON.parse(readFileSync(new URL('docs/readme-claims.json', root), 'utf8')) as unknown,
  read,
);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(
  'T-CLAIMS PASSED: every README section maps to PROVEN claims, existing evidence/code/tests and observed hashes.',
);
