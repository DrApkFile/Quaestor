import { it, expect } from 'vitest';
import { checkClaims, readmeSections } from '../../../scripts/checkClaims.js';
it('T-CLAIMS refuses unproven, unmapped, drifted, missing and unobserved submission claims', () => {
  const readme = '# Demo\nA scoped claim.\n';
  const ledger = '| C1 | Scoped claim | PROVEN (test) | evidence.json | Other flows |';
  const manifest = {
    sections: [
      {
        heading: 'Demo',
        textSha256: readmeSections(readme)[0]?.textSha256,
        claims: ['C1'],
        evidence: ['evidence.json'],
        code: ['source.ts'],
        tests: [{ path: 'test.ts', name: 'A12 test' }],
      },
    ],
  };
  const read = (path: string) => (path === 'test.ts' ? 'A12 test' : '{}');
  expect(checkClaims(readme, ledger, manifest, read)).toEqual([]);
  expect(checkClaims(readme, ledger.replace('PROVEN (test)', 'NOT PROVEN'), manifest, read)).toContain('UNPROVEN:C1');
  expect(checkClaims(readme + '## New\nUnsupported\n', ledger, manifest, read)).toContain('UNMAPPED_SECTION');
  expect(checkClaims(readme + 'Extra claim\n', ledger, manifest, read)).toContain('UNREVIEWED_TEXT');
  expect(checkClaims(readme, ledger, manifest, () => undefined)).toContain('MISSING_FILE:evidence.json');
  expect(checkClaims(readme, ledger, manifest, () => '{}')).toContain('MISSING_TEST:A12 test');
  const hash = `0x${'ab'.repeat(32)}`,
    changed = `${readme}${hash}\n`;
  const observed = structuredClone(manifest);
  const first = observed.sections[0];
  if (first) first.textSha256 = readmeSections(changed)[0]?.textSha256;
  expect(checkClaims(changed, ledger, observed, read)).toContain(`UNOBSERVED_HASH:${hash}`);
});
