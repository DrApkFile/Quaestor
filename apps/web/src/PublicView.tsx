import { Status } from './Status.js';
import { Hash } from './Hash.js';
import { useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import type { publicCheck } from '@quaestor/chain/browser';
import demo from '../public/m7-demo.json';
import { errorMessage } from './messages.js';
export function PublicView() {
  const form = useRef<HTMLFormElement>(null);
  const [book, setBook] = useState(new URLSearchParams(location.search).get('book') ?? demo.honest);
  const [value, setValue] = useState<Awaited<ReturnType<typeof publicCheck>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setValue(null);
    try {
      const id = z
        .string()
        .regex(/^0x[0-9a-f]{64}$/)
        .parse(book.trim().toLowerCase()) as `0x${string}`;
      const [{ publicCheck }, { readerConfig }] = await Promise.all([
        import('@quaestor/chain/public'),
        import('./client.js'),
      ]);
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
      <form ref={form} className="panel search" onSubmit={(event) => void load(event)}>
        <label htmlFor="book-id">Book ID</label>
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
          <button disabled={busy} onClick={() => form.current?.requestSubmit()}>
            Retry check
          </button>
        </p>
      )}
      {busy && (
        <div role="status">
          <progress aria-label="Reading public records" />
          <p>Reading Books and BlobBoard at one pinned height… usually 1–3 minutes on testnet.</p>
        </div>
      )}
      {value && (
        <div className="results">
          <div className="section-heading">
            <h2>Book</h2>
            <span className="muted">Block {value.readBlock}</span>
          </div>
          <dl className="panel addresses">
            <dt>Owner</dt>
            <dd>
              <Hash value={value.owner} />
            </dd>
            <dt>Book ID</dt>
            <dd>
              <Hash value={value.book} />
            </dd>
            <dt>Opening ciphertext</dt>
            <dd>
              <Status code={value.opening.status} />
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
              <span>{value.entries.length === 1 ? 'anchored entry' : 'anchored entries'}</span>
            </div>
            <div className="panel">
              <strong>{value.periods.length}</strong>
              <span>{value.periods.length === 1 ? 'period' : 'periods'}</span>
            </div>
            <div className="panel">
              <strong>{value.grants.length}</strong>
              <span>{value.grants.length === 1 ? 'grant' : 'grants'}</span>
            </div>
          </div>
          <h2>Periods</h2>
          <p className="muted">Period lengths are encrypted; this public view does not infer quarterly or daily.</p>
          <div className="grid">
            {value.periods.map((period) => (
              <article className="panel" key={period.id}>
                <h3>Period {value.periods.indexOf(period) + 1}</h3>
                <Hash value={period.id} />
                <p>
                  {period.count} {period.count === 1 ? 'entry' : 'entries'} · {period.closed ? 'Closed' : 'Open'}
                </p>
                {period.closeBlob && (
                  <div>
                    Close blob: <Status code={period.closeBlob.status} />
                  </div>
                )}
              </article>
            ))}
          </div>
          <h2>Anchored entries</h2>
          <div className="grid">
            {value.entries.map((entry) => (
              <article className="panel" key={`${entry.period}-${String(entry.index)}`}>
                <h3>Entry {entry.index + 1}</h3>
                <Hash value={entry.blobSha3} />
                <Status code={entry.status} />
                <p className="muted">SHA3-256 of on-chain ciphertext</p>
              </article>
            ))}
          </div>
          <h2>Grants</h2>
          {value.grants.map((grant) => (
            <article className="panel grant-row" key={`${grant.period}-${grant.auditor}`}>
              <div>
                <h3>Recipient</h3>
                <Hash value={grant.auditor} />
                <p>Period</p>
                <Hash value={grant.period} />
              </div>
              <Status code={grant.status} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
