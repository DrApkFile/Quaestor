import { useState } from 'react';
import { anchorGrant } from '../business/books.js';
import type { ScreenProps } from './types.js';
export function Grants({ runtime, run, busy }: ScreenProps) {
  const [bookId, setBookId] = useState(runtime.state.books.at(-1)?.id ?? ''),
    [periodId, setPeriodId] = useState(''),
    [auditor, setAuditor] = useState(''),
    [confirmed, setConfirmed] = useState(false);
  const book = runtime.state.books.find((value) => value.id === bookId),
    period = book?.periods.find((value) => value.id === (periodId || book.periods[0]?.id));
  return (
    <section>
      <div className="intro">
        <p className="eyebrow">Grants (demo)</p>
        <h1>
          Open one period.
          <br />
          Keep the rest sealed.
        </h1>
      </div>
      <form
        className="panel narrow"
        onSubmit={(event) => {
          event.preventDefault();
          if (!book || !period || !confirmed) return;
          run(() => anchorGrant(runtime, book, period, auditor));
        }}
      >
        <label>
          Grant book
          <select
            aria-label="Grant book"
            required
            value={bookId}
            onChange={(event) => {
              setBookId(event.target.value);
              setPeriodId('');
            }}
          >
            <option value="">Choose a book</option>
            {runtime.state.books.map((value) => (
              <option key={value.id} value={value.id}>
                {value.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Grant period
          <select
            aria-label="Grant period"
            required
            value={period?.id ?? ''}
            onChange={(event) => {
              setPeriodId(event.target.value);
            }}
          >
            {book?.periods.map((value) => (
              <option key={value.id} value={value.id}>
                {value.id} · {book.mode}
              </option>
            ))}
          </select>
        </label>
        <label>
          Auditor qor1 address
          <input
            required
            value={auditor}
            onChange={(event) => {
              setAuditor(event.target.value.trim());
              setConfirmed(false);
            }}
          />
        </label>
        <aside className="notice">A grant can't be undone. The auditor can keep what they read.</aside>
        <label className="confirm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => {
              setConfirmed(event.target.checked);
            }}
          />
          I understand this grant is permanent
        </label>
        <button disabled={busy || !confirmed || !period}>Verify card and grant period</button>
      </form>
      <div className="panel">
        <h2>Grant transactions</h2>
        {runtime.state.transactions
          .filter((tx) => tx.id.startsWith('grant-') && tx.id.endsWith('-anchor'))
          .map((tx) => (
            <p className="hash" key={tx.id}>
              {tx.hash}
            </p>
          ))}
      </div>
    </section>
  );
}
