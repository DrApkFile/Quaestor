import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
const networkSchema = z
  .object({
    requests: z.number(),
    responses: z.number(),
    leaks: z.literal(0),
    errors: z.array(z.never()),
    pendingInspections: z.literal(0),
  })
  .strict();
const reportSchema = z
  .object({
    command: z.string(),
    commit: z.string(),
    at: z.string(),
    status: z.enum(['PASSED', 'FAILED']),
    origin: z.string(),
    axeTagFilter: z.null(),
    failures: z.array(z.never()),
    broadcasts: z.literal(0),
    legacyJudgeVerified: z.literal(true),
    network: networkSchema,
    results: z.array(
      z
        .object({
          page: z.string(),
          state: z.string(),
          width: z.number(),
          fits: z.literal(true),
          violations: z.array(z.unknown()),
        })
        .passthrough(),
    ),
  })
  .passthrough();
export function mergeAxe(prior: URL, report: URL) {
  const full = reportSchema.parse(JSON.parse(readFileSync(prior, 'utf8')) as unknown);
  const recheck = reportSchema.parse(JSON.parse(readFileSync(report, 'utf8')) as unknown);
  if (
    full.results.length !== 26 ||
    recheck.results.length !== 4 ||
    recheck.status !== 'PASSED' ||
    full.origin !== recheck.origin
  )
    throw new Error('AXE_COVERAGE_INVALID');
  const changedSources = execFileSync('git', ['diff', '--name-only', full.commit, '--', 'apps/web/src'], {
    encoding: 'utf8',
    cwd: new URL('../', import.meta.url),
  })
    .trim()
    .split('\n')
    .filter(Boolean);
  if (
    changedSources.length !== 2 ||
    changedSources.some((file) => !['apps/web/src/Ledger.tsx', 'apps/web/src/AuditResults.tsx'].includes(file))
  )
    throw new Error('UNCHANGED_PAGES_REQUIRED');
  const identity = (value: { page: string; state: string; width: number }) =>
    `${value.page}|${value.state}|${String(value.width)}`;
  const expected = new Set([
    'Auditor|verified deterministic judge records|390',
    'Auditor|verified deterministic judge records|1440',
    'Books|unlocked|390',
    'Books|unlocked|1440',
  ]);
  if (
    new Set(recheck.results.map(identity)).size !== 4 ||
    recheck.results.some((value) => !expected.has(identity(value)))
  )
    throw new Error('LEDGER_RECHECK_REQUIRED');
  const results = full.results.map((value) => {
    const replacement = recheck.results.find((candidate) => identity(candidate) === identity(value));
    return {
      ...(replacement ?? value),
      observed: replacement ? { commit: recheck.commit, at: recheck.at } : { commit: full.commit, at: full.at },
    };
  });
  if (results.some((value) => value.violations.length > 0)) throw new Error('AXE_VIOLATIONS_REMAIN');
  const root = new URL('../', import.meta.url),
    recheckPath = new URL('evidence/m12-axe-ledger-recheck.json', root);
  copyFileSync(report, recheckPath);
  const network = {
    requests: full.network.requests + recheck.network.requests,
    responses: full.network.responses + recheck.network.responses,
    leaks: 0,
    errors: [],
    pendingInspections: 0,
  };
  if (network.requests !== network.responses) throw new Error('NETWORK_INSPECTIONS_INCOMPLETE');
  writeFileSync(
    report,
    JSON.stringify(
      {
        ...recheck,
        command: 'pnpm evidence --m12-axe --ledger-recheck',
        status: 'PASSED',
        results,
        network,
        remainingFindingReasons: [],
        coverage: {
          fullSweep: prior.pathname.split('/').at(-1),
          fullSweepCommit: full.commit,
          recheck: 'evidence/m12-axe-ledger-recheck.json',
          recheckCommit: recheck.commit,
          changedSources,
          retainedUnchangedScans: 22,
          replacedAffectedScans: 4,
          explanation:
            'The full unfiltered sweep checked all nine pages. Only Ledger and AuditResults source changed afterward; populated Auditor and Books were rechecked at both widths. Every result retains its observed commit and timestamp.',
        },
        networkRuns: [
          { commit: full.commit, network: full.network },
          { commit: recheck.commit, network: recheck.network },
        ],
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'M12 axe: 26 observed page/state/width checks, zero violations; 22 unchanged checks retained and four affected checks rerun. Manual-review findings remain listed per node.',
  );
}
