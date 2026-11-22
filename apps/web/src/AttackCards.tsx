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
        <span className="badge bad" data-testid="attack-tampered">
          {original.servedTamper?.kind}
        </span>
        <p>A modified copy of the M4 anchored blob failed the SHA3 check.</p>
        <p>The served copy is modified locally; the original on-chain ciphertext and anchor stay immutable.</p>
        <a href={`${evidence}m4-verdicts.json`}>Tampering evidence</a>
      </article>
      <article className="panel">
        <h2>Reused receipt</h2>
        <span className="badge bad" data-testid="attack-context">
          {wrong?.verdict.kind} ({wrong?.verdict.reason})
        </span>
        <p>An honest book’s receipt was reused in M4; the book, period and entry context check flagged it.</p>
        <a href={`${evidence}m4-verdicts.json`}>Receipt evidence</a>
      </article>
      <article className="panel">
        <h2>Duplicate payment</h2>
        <span className="badge bad" data-testid="attack-duplicate">
          {second?.kind} ({second?.reason})
        </span>
        <p>
          One real payment was booked twice with fresh correctly bound receipts; the repeated commitment check flagged
          the second entry.
        </p>
        <p>
          First entry: <span data-testid="attack-first">{first?.kind}</span>. Both entries were anchored on chain.
        </p>
        <p className="hash">{duplicate.book}</p>
        <a href={`${evidence}m7-duplicate.json`}>Anchored duplicate evidence</a>
      </article>
      <article className="panel">
        <h2>Inflated closing balance</h2>
        <span className="badge bad" data-testid="attack-holdings">
          {original.holdings.kind}
        </span>
        <p>The M4 closing balance exceeded proven holdings; the funds-proof threshold check flagged the shortfall.</p>
        <a href={`${evidence}m4-verdicts.json`}>Holdings evidence</a>
      </article>
    </div>
  );
}
