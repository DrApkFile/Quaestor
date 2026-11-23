import { Status } from './Status.js';
import { Hash } from './Hash.js';
import { demoLabel, humanDate } from './presentation.js';
import { formatUnits, zeroAddress } from 'viem';
import type { Entry, EntryVerdict } from '@quaestor/core';
export interface LedgerRow {
  entry: Pick<Entry, 'period' | 'direction' | 'counterparty' | 'purpose' | 'category' | 'amount' | 'asset'> &
    Partial<Pick<Entry, 'date' | 'receipt'>>;
  status?: 'Anchored' | 'Not booked' | 'Unanchored';
  verdict?: EntryVerdict;
  blobSha3?: string;
  anchorHash?: string | null;
}
export function Ledger({ rows, onRetry }: { rows: readonly LedgerRow[]; onRetry?: () => void }) {
  return (
    <div className="ledger" role="list" aria-label="Private ledger">
      {rows.map((row, index) => (
        <article className="ledger-row" role="listitem" key={index}>
          <div className="ledger-cells" data-private-ledger>
            <div>
              <span className="muted">Date</span>
              <p>{humanDate(row.entry.date ?? row.entry.period)}</p>
            </div>
            <div>
              <span className="muted">Direction</span>
              <p>{row.entry.direction === 'IN' ? 'In' : 'Out'}</p>
            </div>
            <div>
              <span className="muted">Counterparty</span>
              <p>{demoLabel(row.entry.counterparty.name)}</p>
              <Hash value={row.entry.counterparty.address} />
            </div>
            <div>
              <span className="muted">Purpose</span>
              <p>{row.entry.purpose}</p>
              <span className="muted">Category</span>
              <p>{row.entry.category}</p>
            </div>
            <div>
              <span className="muted">Amount</span>
              <p>
                {formatUnits(BigInt(row.entry.amount), row.entry.asset === zeroAddress ? 18 : 6)}{' '}
                {row.entry.asset === zeroAddress ? 'QOR' : 'fUSD'}
              </p>
            </div>
          </div>
          <div className="ledger-verdict">
            {row.verdict ? (
              <>
                <Status code={row.verdict.kind} reason={row.verdict.reason} testId="entry-verdict" />
                {row.verdict.kind === 'UNKNOWN' && onRetry && <button onClick={onRetry}>Retry check</button>}
              </>
            ) : (
              <span className="badge">{row.status}</span>
            )}
          </div>
          <details>
            <summary>Proof details</summary>
            <div data-private-ledger>
              <p>Ciphertext fingerprint</p>
              {row.blobSha3 ? <Hash value={row.blobSha3} /> : <p>Not sealed</p>}
              <p>Anchor transaction</p>
              {row.anchorHash ? <Hash value={row.anchorHash} transaction /> : <p>Not anchored</p>}
              {row.entry.receipt && <pre>{JSON.stringify(row.entry.receipt, null, 2)}</pre>}
            </div>
          </details>
        </article>
      ))}
    </div>
  );
}
