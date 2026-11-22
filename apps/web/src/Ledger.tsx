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
export function Ledger({ rows }: { rows: readonly LedgerRow[] }) {
  return (
    <div className="ledger" role="table" aria-label="Private ledger">
      {rows.map((row, index) => (
        <article className="ledger-row" role="row" key={index}>
          <div className="ledger-cells" data-private-ledger>
            <div>
              <span className="muted">Date</span>
              <p>{row.entry.date?.slice(0, 10) ?? row.entry.period}</p>
            </div>
            <div>
              <span className="muted">Direction</span>
              <p>{row.entry.direction === 'IN' ? 'In' : 'Out'}</p>
            </div>
            <div>
              <span className="muted">Counterparty (demo)</span>
              <p>{row.entry.counterparty.name}</p>
              <p className="hash">{row.entry.counterparty.address}</p>
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
                <span
                  className={`badge ${row.verdict.kind === 'MATCHED' ? 'good' : row.verdict.kind === 'UNKNOWN' ? 'unknown' : 'bad'}`}
                  data-testid="entry-verdict"
                >
                  {row.verdict.kind}
                </span>
                <p>{row.verdict.reason}</p>
              </>
            ) : (
              <span className="badge">{row.status}</span>
            )}
          </div>
          <details>
            <summary>Proof details</summary>
            <div data-private-ledger>
              <p className="hash">Ciphertext SHA3: {row.blobSha3 ?? 'Not sealed'}</p>
              <p className="hash">Anchor transaction: {row.anchorHash ?? 'Not anchored'}</p>
              {row.entry.receipt && <pre>{JSON.stringify(row.entry.receipt, null, 2)}</pre>}
            </div>
          </details>
        </article>
      ))}
    </div>
  );
}
