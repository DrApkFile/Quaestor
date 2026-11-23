import { useEffect, useRef, useState } from 'react';
import type { auditFromChain } from '@quaestor/chain/browser';
import { errorMessage } from './messages.js';
import { AuditResults } from './AuditResults.js';
import { demoAuditorBackup, demoAuditorPassphrase } from './demo.js';
import demo from '../public/m7-demo.json';
import type { DownloadProgress } from './circuits.js';
export function AuditorView() {
  const [bookId, setBookId] = useState(new URLSearchParams(location.search).get('book') ?? demo.honest);
  const [file, setFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [value, setValue] = useState<Awaited<ReturnType<typeof auditFromChain>> | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const retry = useRef<(() => Promise<void>) | null>(null);
  const started = useRef(false);
  const verify = async (input: unknown, phrase: string, book: string) => {
    const [
      { decryptVault },
      { deriveUnifiedAccount },
      { deriveSealKeys },
      { hex32 },
      { auditFromChain },
      { readerConfig },
      { installAuditPrivacy },
    ] = await Promise.all([
      import('./vault.js'),
      import('@qorechain/sdk'),
      import('@qorechain/qoreseal'),
      import('@quaestor/core'),
      import('@quaestor/chain/audit'),
      import('./client.js'),
      import('./privacy.js'),
    ]);
    const payload = await decryptVault(input, phrase);
    setPassphrase('');
    const account = await deriveUnifiedAccount(payload.mnemonic, 0);
    const keys = deriveSealKeys({ mnemonic: payload.mnemonic, index: 0 });
    installAuditPrivacy(account, keys);
    const id = hex32.parse(book.trim().toLowerCase());
    const check = async () => {
      setValue(await auditFromChain(readerConfig(setProgress), id, { address: account.cosmos, keys }));
    };
    retry.current = check;
    await check();
  };
  const task = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setValue(null);
    try {
      await work();
    } catch (error: unknown) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const runDemo = () =>
    task(async () => {
      const response = await fetch(demoAuditorBackup);
      if (!response.ok) throw new Error('NETWORK_UNAVAILABLE');
      const input: unknown = await response.json();
      setBookId(demo.honest);
      await verify(input, demoAuditorPassphrase, demo.honest);
    });
  useEffect(() => {
    if (!started.current && new URLSearchParams(location.search).get('demo') === '1') {
      started.current = true;
      void runDemo();
    }
  }, []);
  return (
    <section>
      <div className="intro">
        <p className="eyebrow">Auditor</p>
        <h1>One quarter for your auditor.</h1>
        <p>
          Open one shared period. Every other period stays sealed. Ciphertexts come from the chain; decryption and proof
          checks run in this browser.
        </p>
      </div>
      <div className="panel tone-sage">
        <h2>See the Northwind book</h2>
        <p>
          Fictional studio, five real testnet payments. The public auditor backup and its published passphrase load
          automatically. The demo uses daily periods to show the access boundary.
        </p>
        <button disabled={busy} onClick={() => void runDemo()}>
          Try the demo auditor
        </button>
        <p>Read-only. This page cannot send transactions.</p>
      </div>
      <details className="panel">
        <summary>Use your own auditor backup</summary>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (file)
              void task(async () => {
                const input: unknown = JSON.parse(await file.text());
                await verify(input, passphrase, bookId);
              });
          }}
        >
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
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
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
            onChange={(event) => {
              setPassphrase(event.target.value);
            }}
          />
          <button disabled={busy || !file}>Open granted period</button>
        </form>
      </details>
      {error && (
        <div className="error" role="alert">
          <p>{error}</p>
          <button disabled={busy} onClick={() => void task(retry.current ?? (() => runDemo()))}>
            Retry check
          </button>
        </div>
      )}
      {busy && (
        <div className="panel" role="status">
          <p>Reading encrypted records and checking proofs… usually 1–5 minutes for the first testnet check.</p>
          <progress aria-label="Checking granted periods" />
          {progress && (
            <>
              <p>
                {progress.file}: {(progress.loaded / 1048576).toFixed(1)} MB
                {progress.total ? ` of ${(progress.total / 1048576).toFixed(1)} MB` : ''}
                {progress.cached ? ' (cached)' : ''}
              </p>
              <progress
                aria-label="Circuit download"
                value={progress.loaded}
                max={progress.total ?? Math.max(progress.loaded, 1)}
              />
            </>
          )}
        </div>
      )}
      {value && (
        <AuditResults
          value={value}
          busy={busy}
          onRetry={() => {
            if (retry.current) void task(retry.current);
          }}
        />
      )}
    </section>
  );
}
