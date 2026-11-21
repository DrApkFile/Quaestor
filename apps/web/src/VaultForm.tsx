import type { FormEvent } from 'react';
interface Props {
  stored: boolean;
  busy: boolean;
  passphrase: string;
  error: string;
  onPassphrase: (value: string) => void;
  onCreate: (event: FormEvent) => void;
  onUnlock: () => void;
  onRestore: (file: File) => void;
}
export function VaultForm({ stored, busy, passphrase, error, onPassphrase, onCreate, onUnlock, onRestore }: Props) {
  return (
    <section>
      <div className="intro">
        <p className="eyebrow">Account (demo)</p>
        <h1>Keep the keys with you.</h1>
        <p>Create an account or restore an encrypted backup. Transactions stay locked until you download a backup.</p>
      </div>
      <form className="panel narrow" onSubmit={onCreate}>
        <h2>{stored ? 'Unlock or create an account' : 'Create or restore'}</h2>
        <label htmlFor="account-passphrase">Passphrase</label>
        <input
          id="account-passphrase"
          type="password"
          autoComplete="new-password"
          value={passphrase}
          onChange={(e) => {
            onPassphrase(e.target.value);
          }}
          minLength={12}
          required
        />
        <div className="actions">
          {stored && (
            <button type="button" disabled={busy} onClick={onUnlock}>
              Unlock saved account
            </button>
          )}
          <button disabled={busy} type="submit">
            {busy ? 'Working…' : 'Create account'}
          </button>
        </div>
        <label className="file-label" htmlFor="account-backup">
          Restore encrypted backup
        </label>
        <input
          id="account-backup"
          type="file"
          accept="application/json,.json"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onRestore(file);
          }}
        />
        <p className="muted">Use at least 12 characters. Your passphrase is not sent to a server.</p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
