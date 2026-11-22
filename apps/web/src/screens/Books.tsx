import { useState } from 'react';
import { createBook, nextPeriod } from '../business/books.js';
import { closePeriod } from '../business/close.js';
import type { Book } from '../business/schema.js';
import type { ScreenProps } from './types.js';
import { OwnerLedger } from './OwnerLedger.js';
import { EntryForm } from './EntryForm.js';
export function Books(props: ScreenProps) {
  const { runtime, run, busy } = props;
  const [name, setName] = useState('My business'),
    [mode, setMode] = useState<Book['mode']>('Quarterly'),
    [selected, setSelected] = useState(runtime.state.books.at(-1)?.id ?? '');
  const book = runtime.state.books.find((value) => value.id === selected) ?? runtime.state.books.at(-1);
  const active = book?.periods.find((value) => value.id === book.active);
  return (
    <section>
      <div className="intro">
        <p className="eyebrow">Books (demo)</p>
        <h1>
          Sealed by period.
          <br />
          Checked by proof.
        </h1>
      </div>
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
          run(async () => {
            const created = await createBook(runtime, name, mode);
            setSelected(created.id);
          });
        }}
      >
        <h2>Create a book</h2>
        <div className="grid">
          <label>
            Book name
            <input
              required
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </label>
          <label>
            Period length
            <select
              aria-label="Period length"
              value={mode}
              onChange={(event) => {
                setMode(event.target.value as Book['mode']);
              }}
            >
              <option>Quarterly</option>
              <option>Daily (demo-scale)</option>
            </select>
          </label>
        </div>
        <button disabled={busy}>Sign and create book</button>
      </form>
      {book && (
        <>
          <div className="panel">
            <label>
              Book (demo)
              <select
                aria-label="Book (demo)"
                value={book.id}
                onChange={(event) => {
                  setSelected(event.target.value);
                }}
              >
                {runtime.state.books.map((value) => (
                  <option value={value.id} key={value.id}>
                    {value.name}
                  </option>
                ))}
              </select>
            </label>
            <h2>{book.name}</h2>
            <p className="hash" data-testid="book-id">
              {book.id}
            </p>
            <span className="badge">{book.mode}</span>
            <p>
              Opening record: ciphertext SHA3 {book.sealedOpening.sha3.slice(0, 18)}… ·{' '}
              {book.registered ? 'Anchored' : 'Not anchored'}
            </p>
          </div>
          {runtime.state.payments
            .filter((payment) => payment.stage !== 'ANCHORED' && (!payment.book || payment.book === book.id))
            .map((payment) => (
              <EntryForm {...props} book={book} payment={payment} key={payment.id} />
            ))}
          <div className="results">
            {book.periods.map((period) => (
              <article className="panel" key={period.id}>
                <h2>
                  {period.id} · {book.mode}
                </h2>
                <p>
                  {period.closed ? 'Closed' : 'Open'} · {period.entries.length}{' '}
                  {period.entries.length === 1 ? 'entry' : 'entries'}
                </p>
                <OwnerLedger runtime={runtime} book={book} period={period} />
              </article>
            ))}
          </div>
          {active && !active.closed && (
            <div className="panel tone-lemon">
              <h2>
                Close {active.id} · {book.mode}
              </h2>
              <p>Close locks this period. The proof uses up to four of the largest unspent notes per asset.</p>
              <p className="muted">
                If coverage needs more notes: This period's balance is spread across more than four private notes, and
                the pool can't merge notes, so it can't be proven in one step yet.
              </p>
              <button
                disabled={busy}
                onClick={() => {
                  run(() => closePeriod(runtime, book));
                }}
              >
                Build holdings proof and close
              </button>
            </div>
          )}
          {active?.closed && (
            <button
              disabled={busy}
              onClick={() => {
                run(() => nextPeriod(runtime, book));
              }}
            >
              Open next {book.mode} period
            </button>
          )}
        </>
      )}
      {!book && runtime.state.payments.length > 0 && (
        <aside className="notice">
          {runtime.state.payments.length} {runtime.state.payments.length === 1 ? 'payment is' : 'payments are'} Not
          booked. Create a book to record them.
        </aside>
      )}
    </section>
  );
}
