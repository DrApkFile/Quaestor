import { createHash } from 'node:crypto';
import { z } from 'zod';
const support = z
  .object({
    heading: z.string().min(1),
    textSha256: z.string().regex(/^[a-f0-9]{64}$/),
    claims: z.array(z.string()).min(1),
    evidence: z.array(z.string()).min(1),
    code: z.array(z.string()).min(1),
    tests: z.array(z.object({ path: z.string(), name: z.string() }).strict()).min(1),
  })
  .strict();
export const claimsManifest = z.object({ sections: z.array(support).min(1) }).strict();
export function readmeSections(readme: string) {
  return readme.split(/(?=^## )/m).map((text) => ({
    heading: text.split('\n')[0]?.replace(/^#+ /, '') ?? '',
    text,
    textSha256: createHash('sha256').update(text).digest('hex'),
  }));
}
export function checkClaims(readme: string, ledger: string, raw: unknown, read: (path: string) => string | undefined) {
  const manifest = claimsManifest.parse(raw);
  const errors: string[] = [];
  const rows = ledger
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .map((line) => line.split('|').map((value) => value.trim()));
  const sections = readmeSections(readme);
  if (sections.length !== manifest.sections.length) errors.push('UNMAPPED_SECTION');
  for (const section of sections) {
    const mapping = manifest.sections.filter((value) => value.heading === section.heading);
    if (mapping.length !== 1) {
      errors.push('UNMAPPED_SECTION');
      continue;
    }
    const item = mapping[0];
    if (!item) continue;
    if (item.textSha256 !== section.textSha256) errors.push('UNREVIEWED_TEXT');
    for (const id of item.claims) {
      const row = rows.find((value) => value[1] === id);
      if (!row || !/^PROVEN(?: \(|$)/.test(row[3] ?? '')) errors.push(`UNPROVEN:${id}`);
      if (!item.evidence.some((path) => row?.[4]?.includes(path))) errors.push(`UNLINKED_EVIDENCE:${id}`);
    }
    const bodies = item.evidence.map((path) => read(path));
    for (const path of [...item.evidence, ...item.code])
      if (read(path) === undefined) errors.push(`MISSING_FILE:${path}`);
    for (const test of item.tests) if (!read(test.path)?.includes(test.name)) errors.push(`MISSING_TEST:${test.name}`);
    const recorded = bodies.join('\n').toLowerCase();
    for (const hash of section.text.match(/\b(?:0x)?[a-fA-F0-9]{64}\b/g) ?? []) {
      if (!recorded.includes(hash.toLowerCase())) errors.push(`UNOBSERVED_HASH:${hash}`);
    }
  }
  return [...new Set(errors)];
}
