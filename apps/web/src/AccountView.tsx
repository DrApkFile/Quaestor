import { VaultForm } from './VaultForm.js';
import { OnboardingSteps } from './OnboardingSteps.js';
import { useEffect, useState, type FormEvent } from 'react';
import { generateMnemonic, deriveUnifiedAccount, type UnifiedAccount } from '@qorechain/sdk';
import { encryptVault, decryptVault, vaultSchema, type VaultEnvelope } from './vault.js';
import { saveVault, loadVault } from './db.js';
import { onboardingStatus, registerPQ, registerKEM, publishCard } from './onboarding.js';
import { errorMessage } from './messages.js';
export function AccountView({
  onReady,
  onLock,
}: {
  onReady?: (account: UnifiedAccount) => Promise<void>;
  onLock?: () => void;
}) {
  const [account, setAccount] = useState<UnifiedAccount | null>(null);
  const [envelope, setEnvelope] = useState<VaultEnvelope | null>(null);
  const [backup, setBackup] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [stored, setStored] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<Awaited<ReturnType<typeof onboardingStatus>> | null>(null);
  useEffect(() => {
    void loadVault()
      .then((value) => {
        setStored(value !== null);
      })
      .catch((e: unknown) => {
        setError(errorMessage(e));
      });
  }, []);
  const refresh = async (value = account) => {
    if (value) setStatus(await onboardingStatus(value));
  };
  const task = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const create = (event: FormEvent) => {
    event.preventDefault();
    void task(async () => {
      const mnemonic = generateMnemonic();
      const sealed = await encryptVault(mnemonic, passphrase);
      const derived = await deriveUnifiedAccount(mnemonic, 0);
      await saveVault(sealed);
      setEnvelope(sealed);
      setAccount(derived);
      setBackup(false);
      setPassphrase('');
      await refresh(derived);
    });
  };
  const restore = async (file: File) => {
    await task(async () => {
      const input: unknown = JSON.parse(await file.text());
      const payload = await decryptVault(input, passphrase);
      const sealed = vaultSchema.parse(input);
      const derived = await deriveUnifiedAccount(payload.mnemonic, 0);
      await saveVault(sealed);
      setAccount(derived);
      setEnvelope(sealed);
      setBackup(false);
      setPassphrase('');
      await refresh(derived);
    });
  };
  const unlock = () =>
    task(async () => {
      const saved = await loadVault();
      if (!saved) throw new Error('INVALID_PASSPHRASE_OR_BACKUP');
      const payload = await decryptVault(saved.envelope, passphrase);
      const derived = await deriveUnifiedAccount(payload.mnemonic, 0);
      setAccount(derived);
      setEnvelope(saved.envelope);
      setBackup(saved.backupDownloaded);
      if (saved.backupDownloaded) await onReady?.(derived);
      setPassphrase('');
      await refresh(derived);
    });
  const download = () => {
    if (!envelope) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(envelope)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'quaestor-testnet-encrypted-backup.json';
    anchor.click();
    URL.revokeObjectURL(url);
    void task(async () => {
      await saveVault(envelope, true);
      setBackup(true);
      if (account) await onReady?.(account);
    });
  };
  const act = (kind: 'pq' | 'kem' | 'card') =>
    task(async () => {
      if (!account || !backup) throw new Error('BACKUP_REQUIRED');
      if (kind === 'pq') await registerPQ(account, backup);
      if (kind === 'kem') await registerKEM(account, backup);
      if (kind === 'card') await publishCard(account, backup);
      await refresh(account);
    });
  if (!account)
    return (
      <VaultForm
        stored={stored}
        busy={busy}
        passphrase={passphrase}
        error={error}
        onPassphrase={setPassphrase}
        onCreate={create}
        onUnlock={() => void unlock()}
        onRestore={(file) => void restore(file)}
      />
    );
  const ready =
    backup &&
    !!status?.funded &&
    status.pqRegistered &&
    status.kemRegistered &&
    status.cardPublished &&
    status.keysMatch;
  return (
    <section>
      <div className="intro">
        <p className="eyebrow">Account (demo)</p>
        <h1>{ready ? 'Account ready.' : 'Set up your account.'}</h1>
        <p>Each step below is checked against Diana. Refresh to see a funding or registration change.</p>
      </div>
      <div className="panel">
        <h2>Encrypted backup</h2>
        <p>
          {backup ? 'Backup download completed.' : 'Download an encrypted backup before any transaction is enabled.'}
        </p>
        <button disabled={busy} onClick={download}>
          Download encrypted backup
        </button>
        <dl className="addresses">
          <dt>Native address (demo)</dt>
          <dd>{account.cosmos}</dd>
          <dt>EVM address (demo)</dt>
          <dd>{account.evm}</dd>
        </dl>
        <div className="actions">
          <button className="secondary" disabled={busy} onClick={() => void task(() => refresh())}>
            Refresh chain state
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              onLock?.();
              setAccount(null);
              setStatus(null);
              setStored(true);
            }}
          >
            Lock account
          </button>
        </div>
      </div>
      <OnboardingSteps status={status} busy={busy} backup={backup} onAction={(kind) => void act(kind)} />
      {status && !status.keysMatch && (
        <p role="alert" className="error">
          The registered keys do not match this backup. Nothing will be overwritten.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {busy && <p role="status">Waiting for the chain…</p>}
    </section>
  );
}
