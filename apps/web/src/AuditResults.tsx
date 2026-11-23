import type { auditFromChain } from '@quaestor/chain/browser';
import { Ledger } from './Ledger.js';
import { Status } from './Status.js';
import { demoLabel, humanDate } from './presentation.js';
import { Hash } from './Hash.js';
export function AuditResults({
  value,
  busy,
  onRetry,
}: {
  value: Awaited<ReturnType<typeof auditFromChain>>;
  busy: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="results" data-testid="audit-results" data-book={value.book}>
      <div className="section-heading">
        <h2>Audit results</h2>
        <span className="muted">Read block {value.readBlock}</span>
      </div>
      <div>
        Book: <Hash value={value.book} />
      </div>
      <p className="notice">Only periods shared with this auditor can be opened. Every other period stays sealed.</p>
      <div className="stats" aria-label="Period access at a glance">
        {value.periods.map((period) => (
          <article className="panel" key={period.id}>
            <h3>{humanDate(period.label)}</h3>
            <span className="badge neutral">{period.kind === 'AUDITED' ? 'Shared with you' : 'Stays sealed'}</span>
            <p>
              {period.kind === 'AUDITED'
                ? `${String(period.entries.length)} readable entries; checks below.`
                : 'No entries opened. Only the business can share this period.'}
            </p>
          </article>
        ))}
      </div>
      {value.periods.map((period) => (
        <article className="panel period-result" key={period.id}>
          <h2>
            {humanDate(period.label)} · {demoLabel(value.periodLength)}
          </h2>
          {period.kind === 'AUDITED' ? (
            <>
              <Status code={period.holdings.kind} testId="period-verdict" />
              {period.holdings.kind === 'UNKNOWN' && (
                <button disabled={busy} onClick={onRetry}>
                  Retry check
                </button>
              )}
              <p>
                Holdings checked at close block {period.closeBlock}. This is a lower-bound check, not a complete income
                audit.
              </p>
              <p className="notice">{period.openingBasis}</p>
              <Ledger
                rows={period.entries.map((row) => ({
                  entry: row.entry,
                  verdict: row.verdict,
                  blobSha3: row.blobSha3,
                  anchorHash: row.anchorHash,
                }))}
                onRetry={onRetry}
              />
              {period.legacyRecordsVerified && (
                <p className="muted">
                  Legacy record mappings, owner signatures and decrypted plaintext anchors verified.
                </p>
              )}
            </>
          ) : (
            <Status code={period.reason} />
          )}
        </article>
      ))}
    </div>
  );
}
