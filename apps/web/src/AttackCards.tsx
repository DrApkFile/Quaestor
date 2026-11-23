import { Hash } from './Hash.js';
import { Status } from './Status.js';
import type { auditFromChain } from '@quaestor/chain/browser';
type Audit = Awaited<ReturnType<typeof auditFromChain>>;
type Period = Extract<Audit['periods'][number], { kind: 'AUDITED' }>;
const evidence = 'https://github.com/DrApkFile/Quaestor/blob/master/evidence/';
export function AttackCards({ original, duplicate }: { original: Period; duplicate: Audit }) {
  const wrong = original.entries.find((value) => value.verdict.reason === 'WRONG_CONTEXT');
  const replay = duplicate.periods.find((period) => period.kind === 'AUDITED');
  const first = replay?.entries[0]?.verdict,
    second = replay?.entries[1]?.verdict;
  return (
    <div className="grid">
      <article className="panel">
        <h2>Changed ciphertext</h2>
        <Status code={original.servedTamper?.kind ?? 'UNKNOWN'} testId="attack-tampered" />
        <p>A modified copy of the M4 anchored blob failed the SHA3 check.</p>
        <p>The served copy is modified locally; the original on-chain ciphertext and anchor stay immutable.</p>
        <a href={`${evidence}m4-verdicts.json`}>Tampering evidence</a>
      </article>
      <article className="panel">
        <h2>Reused receipt</h2>
        <Status code={wrong?.verdict.kind ?? 'UNKNOWN'} reason={wrong?.verdict.reason} testId="attack-context" />
        <p>An honest book’s receipt was reused in M4; the book, period and entry context check flagged it.</p>
        <a href={`${evidence}m4-verdicts.json`}>Receipt evidence</a>
      </article>
      <article className="panel">
        <h2>Duplicate payment</h2>
        <Status code={second?.kind ?? 'UNKNOWN'} reason={second?.reason} testId="attack-duplicate" />
        <p>
          One real payment was booked twice with fresh correctly bound receipts; the repeated commitment check flagged
          the second entry.
        </p>
        <div>
          First entry: <Status code={first?.kind ?? 'UNKNOWN'} testId="attack-first" />. Both entries were anchored on
          chain.
        </div>
        <Hash value={duplicate.book} />
        <a href={`${evidence}m7-duplicate.json`}>Anchored duplicate evidence</a>
      </article>
      <article className="panel">
        <h2>Inflated closing balance</h2>
        <Status code={original.holdings.kind} testId="attack-holdings" />
        <p>The M4 closing balance exceeded proven holdings; the funds-proof threshold check flagged the shortfall.</p>
        <a href={`${evidence}m4-verdicts.json`}>Holdings evidence</a>
      </article>
    </div>
  );
}
