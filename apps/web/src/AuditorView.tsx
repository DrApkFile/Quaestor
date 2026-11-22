import { installAuditPrivacy } from './privacy.js';
import { useState, type FormEvent } from 'react';
import { deriveUnifiedAccount } from '@qorechain/sdk';
import { deriveSealKeys } from '@qorechain/qoreseal';
import { auditFromChain } from '@quaestor/chain/browser';
import { decryptVault } from './vault.js';
import { readerConfig, deployment } from './client.js';
import { errorMessage } from './messages.js';
import type { DownloadProgress } from './circuits.js';
export function AuditorView() {
  const [bookId, setBookId] = useState(new URLSearchParams(location.search).get('book') ?? deployment.demo.honest);
  const [file, setFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [value, setValue] = useState<Awaited<ReturnType<typeof auditFromChain>> | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const run = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError('');
    setValue(null);
    try {
      const input: unknown = JSON.parse(await file.text());
      const payload = await decryptVault(input, passphrase);
      setPassphrase('');
      const account = await deriveUnifiedAccount(payload.mnemonic, 0);
      const keys = deriveSealKeys({ mnemonic: payload.mnemonic, index: 0 });
      installAuditPrivacy(account, keys);
      setValue(
        await auditFromChain(readerConfig(setProgress), bookId as `0x${string}`, {
          address: account.cosmos,
          keys,
        }),
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
        <p className="eyebrow">Auditor (demo)</p>
        <h1>Open only the granted period.</h1>
        <p>
          Load the auditor’s encrypted backup to verify the chosen demo book. Ciphertexts come from BlobBoard;
          decryption and proof verification run in this browser.
        </p>
      </div>
      <form className="panel narrow" onSubmit={(event) => void run(event)}>
        <h2>Auditor backup (demo)</h2>
        <label htmlFor="auditor-book">Audit book ID</label>
        <input
          id="auditor-book"
          required
          value={bookId}
          onChange={(event) => {
            setBookId(event.target.value);
          }}
        />
        <label htmlFor="auditor-backup">Encrypted backup file</label>
        <input
          id="auditor-backup"
          type="file"
          accept="application/json,.json"
          required
          disabled={busy}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
          }}
        />
        <label htmlFor="auditor-passphrase">Backup passphrase</label>
        <input
          id="auditor-passphrase"
          type="password"
          autoComplete="off"
          required
          value={passphrase}
          disabled={busy}
          onChange={(e) => {
            setPassphrase(e.target.value);
          }}
        />
        <button disabled={busy || !file}>{busy ? 'Verifying…' : 'Open granted period'}</button>
        <p className="muted">This view cannot send transactions.</p>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {busy && (
        <div className="panel" role="status">
          <p>Fetching ciphertexts and checking the close snapshot…</p>
          {progress && (
            <>
              <label htmlFor="circuit-progress">
                {progress.file}{' '}
                {progress.cached ? '— cached' : `— ${String(Math.ceil(progress.loaded / 1024))} KB downloaded`}
              </label>
              <progress
                id="circuit-progress"
                value={progress.loaded}
                max={progress.total ?? Math.max(progress.loaded, 1)}
              />
            </>
          )}
        </div>
      )}
      {value && (
        <div className="results">
          <div className="section-heading">
            <h2>Audit results (demo)</h2>
            <span className="muted">Read block {value.readBlock}</span>
          </div>
          {value.periods.map((period) => (
            <article className="panel period-result" key={period.id}>
              <h2>
                {period.label} · {value.periodLength} (demo)
              </h2>
              {period.kind === 'AUDITED' ? (
                <>
                  <span
                    className={`badge ${period.holdings.kind === 'HOLDINGS_COVER_BOOKS' ? 'good' : 'bad'}`}
                    data-testid="period-verdict"
                  >
                    {period.holdings.kind}
                  </span>
                  <p>
                    Holdings checked at close block {period.closeBlock}. This is a lower-bound check, not a complete
                    income audit.
                  </p>
                  <div className="entry-results">
                    {period.entries.map((entry) => (
                      <div className="entry-result" key={entry.index}>
                        <div>
                          <h3>Entry {entry.index + 1} (demo)</h3>
                          <p className="hash">{entry.blobSha3}</p>
                        </div>
                        <div>
                          <span
                            className={`badge ${entry.verdict.kind === 'MATCHED' ? 'good' : entry.verdict.kind === 'UNKNOWN' ? 'unknown' : 'bad'}`}
                            data-testid="entry-verdict"
                          >
                            {entry.verdict.kind}
                          </span>
                          <p className="reason">{entry.verdict.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {period.legacyRecordsVerified && (
                    <p className="muted">
                      Legacy record mappings, owner signatures and decrypted plaintext anchors verified.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <span className="badge unknown">{period.reason}</span>
                  <p>
                    {period.reason === 'NOT_GRANTED'
                      ? 'This auditor was not granted this period. No entry is opened.'
                      : 'This period is still open.'}
                  </p>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
