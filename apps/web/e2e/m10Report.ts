import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { m10Attempt } from './m10Attempt.js';
export function m10Report(report: Record<string, unknown>) {
  const attempt = m10Attempt();
  const target = '../../evidence/m10-fresh-signup.json';
  if (existsSync(target)) copyFileSync(target, `../../evidence/m10-fresh-signup-attempt-${String(Date.now())}.json`);
  const record =
    JSON.stringify(
      {
        ...report,
        attemptId: attempt.id,
        sourceCommit: attempt.sourceCommit,
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
    ) + '\n';
  const directory = `../../evidence/m10-signup-attempts/${attempt.id}`;
  mkdirSync(directory, { recursive: true });
  writeFileSync(`${directory}/report.json`, record, { flag: 'wx' });
  writeFileSync(target, record);
}
