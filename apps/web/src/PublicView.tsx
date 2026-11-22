import { useState, type FormEvent } from 'react';
import { hex32 } from '@quaestor/core';
import { publicCheck } from '@quaestor/chain/browser';
import { deployment, readerConfig } from './client.js';
import { errorMessage } from './messages.js';
export function PublicView() {
  const [book, setBook] = useState(new URLSearchParams(location.search).get('book') ?? deployment.demo.honest);
  const [value, setValue] = useState<Awaited<ReturnType<typeof publicCheck>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setValue(null);
    try {
      const id = hex32.parse(book.trim().toLowerCase());
      setValue(
        await publicCheck(
          readerConfig(() => undefined),
          id,
        ),
      );
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <div className="intro">
        <p className="eyebrow">Public check</p>
        <h1>Check the public record.</h1>
        <p>See on-chain anchors and verify ciphertext hashes. No records are decrypted in this view.</p>
      </div>
      <form className="panel search" onSubmit={(event) => void load(event)}>
        <label htmlFor="book-id">Book ID (demo)</label>
        <div className="input-action">
          <input
            id="book-id"
            value={book}
            onChange={(e) => {
              setBook(e.target.value);
            }}
            spellCheck={false}
            required
          />
          <button disabled={busy}>{busy ? 'Checking…' : 'Check chain'}</button>
        </div>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {busy && <p role="status">Reading Books and BlobBoard at one pinned height…</p>}
      {value && (
        <div className="results">
          <div className="section-heading">
            <h2>Book (demo)</h2>
            <span className="muted">Block {value.readBlock}</span>
          </div>
          <dl className="panel addresses">
            <dt>Owner (demo)</dt>
            <dd>{value.owner}</dd>
            <dt>Book ID (demo)</dt>
            <dd>{value.book}</dd>
            <dt>Opening ciphertext</dt>
            <dd>
              <span className={`badge ${value.opening.status === 'VERIFIED' ? 'good' : 'unknown'}`}>
                {value.opening.status}
              </span>
            </dd>
          </dl>
          {value.opening.legacy && (
            <aside className="notice">
              Legacy M4 demo: opening balances should be treated as disclosed. Ciphertext hashes and owner-signed
              mappings are checked here; the plaintext link is checked only by an authorized auditor.
            </aside>
          )}
          <div className="stats">
            <div className="panel">
              <strong>{value.entries.length}</strong>
              <span>anchored entries</span>
            </div>
            <div className="panel">
              <strong>{value.periods.length}</strong>
              <span>periods</span>
            </div>
            <div className="panel">
              <strong>{value.grants.length}</strong>
              <span>grants</span>
            </div>
          </div>
          <h2>Periods</h2>
          <p className="muted">Period lengths are encrypted; this public view does not infer quarterly or daily.</p>
          <div className="grid">
            {value.periods.map((period) => (
              <article className="panel" key={period.id}>
                <h3>Period {value.periods.indexOf(period) + 1} (demo)</h3>
                <p className="hash">{period.id}</p>
                <p>
                  {period.count} {period.count === 1 ? 'entry' : 'entries'} · {period.closed ? 'Closed' : 'Open'}
                </p>
                {period.closeBlob && (
                  <p>
                    Close blob:{' '}
                    <span className={`badge ${period.closeBlob.status === 'VERIFIED' ? 'good' : 'unknown'}`}>
                      {period.closeBlob.status}
                    </span>
                  </p>
                )}
              </article>
            ))}
          </div>
          <h2>Anchored entries</h2>
          <div className="grid">
            {value.entries.map((entry) => (
              <article className="panel" key={`${entry.period}-${String(entry.index)}`}>
                <h3>Entry {entry.index + 1} (demo)</h3>
                <p className="hash">{entry.blobSha3}</p>
                <span className={`badge ${entry.status === 'VERIFIED' ? 'good' : 'unknown'}`}>{entry.status}</span>
                <p className="muted">SHA3-256 of on-chain ciphertext</p>
              </article>
            ))}
          </div>
          <h2>Grants</h2>
          {value.grants.map((grant) => (
            <article className="panel grant-row" key={`${grant.period}-${grant.auditor}`}>
              <div>
                <h3>Recipient (demo)</h3>
                <p className="hash">{grant.auditor}</p>
                <p className="hash">Period {grant.period}</p>
              </div>
              <span className={`badge ${grant.status === 'VERIFIED' ? 'good' : 'unknown'}`}>{grant.status}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
