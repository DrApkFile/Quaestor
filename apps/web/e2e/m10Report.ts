import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
export function m10Report(report: Record<string, unknown>) {
  const target = '../../evidence/m10-fresh-signup.json';
  if (existsSync(target)) copyFileSync(target, `../../evidence/m10-fresh-signup-attempt-${String(Date.now())}.json`);
  writeFileSync(
    target,
    JSON.stringify(
      {
        ...report,
        command: 'pnpm evidence --m10-fresh-signup',
        doesNotEstablish: [
          'arbitrary browser or extension safety',
          'unknown secret encodings',
          'post-quantum Groth16',
          'fUSD or cash-out browser privacy',
          'metadata privacy',
          'bookkeeping completeness',
        ],
      },
      null,
      2,
    ) + '\n',
  );
}
