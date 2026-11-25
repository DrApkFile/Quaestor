import { exportBackup, restoreJournal } from './backup.js';
import { VaultForm } from './VaultForm.js';
import { AccountSetup } from './AccountSetup.js';
import { useEffect, useState, type FormEvent } from 'react';
import { generateMnemonic, deriveUnifiedAccount, type UnifiedAccount } from '@qorechain/sdk';
import { encryptVault, decryptVault, vaultSchema, type VaultEnvelope } from './vault.js';
import { saveVault, loadVault } from './db.js';
import { onboardingStatus } from './onboarding.js';
import { activateAccount, type ActivationStage } from './activation.js';
import { installAuditPrivacy } from './privacy.js';
import { accountSealKeys } from '@quaestor/chain/browser';
import { errorMessage } from './messages.js';
export function AccountView({
  onReady,
  onLock,
}: {
  onReady?: (account: UnifiedAccount) => Promise<void>;
  onLock?: () => void;
}) {
  const [stage, setStage] = useState<ActivationStage | null>(null);
  const [failedStage, setFailedStage] = useState<ActivationStage | null>(null);
  const [account, setAccount] = useState<UnifiedAccount | null>(null);
  const [envelope, setEnvelope] = useState<VaultEnvelope | null>(null);
  const [backup, setBackup] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [backupPassphrase, setBackupPassphrase] = useState('');
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
      installAuditPrivacy(derived, accountSealKeys(derived));
      setBackupPassphrase(passphrase);
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
      installAuditPrivacy(derived, accountSealKeys(derived));
      await restoreJournal(derived.cosmos, payload.journal);
      setBackupPassphrase(passphrase);
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
      installAuditPrivacy(derived, accountSealKeys(derived));
      setBackupPassphrase(passphrase);
      setAccount(derived);
      setEnvelope(saved.envelope);
      setBackup(saved.backupDownloaded);
      if (saved.backupDownloaded) await onReady?.(derived);
      setPassphrase('');
      await refresh(derived);
    });
  const download = () => {
    if (!account || !envelope) return;
    void task(async () => {
      const complete = await exportBackup(account, backupPassphrase);
      const url = URL.createObjectURL(new Blob([JSON.stringify(complete)], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'quaestor-testnet-encrypted-backup.json';
      anchor.click();
      URL.revokeObjectURL(url);
      setEnvelope(complete);
      setBackupPassphrase('');
      await saveVault(complete, true);
      setBackup(true);
      await onReady?.(account);
      await refresh(account);
    });
  };
  useEffect(() => {
    if (!account || busy || status?.cardPublished) return;
    let cancelled = false;
    const poll = setInterval(() => {
      void onboardingStatus(account)
        .then((value) => {
          if (!cancelled) setStatus(value);
        })
        .catch(() => {
          if (!cancelled) setError(errorMessage(new Error('NETWORK_UNAVAILABLE')));
        });
    }, 10000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [account, busy, status?.cardPublished]);
  const activate = () =>
    task(async () => {
      if (!account || !backup) throw new Error('BACKUP_REQUIRED');
      setFailedStage(null);
      let current: ActivationStage = 0;
      try {
        setStatus(
          await activateAccount(account, backup, (next, value) => {
            current = next;
            setStage(next);
            setStatus(value);
          }),
        );
      } catch (error: unknown) {
        setFailedStage(error instanceof Error && error.message === 'WINDOW_DECLINED' ? null : current);
        throw error;
      }
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
  return (
    <AccountSetup
      account={account}
      backup={backup}
      backupPassphrase={backupPassphrase}
      busy={busy}
      error={error}
      status={status}
      stage={stage}
      failedStage={failedStage}
      onBackupPassphrase={setBackupPassphrase}
      onDownload={download}
      onRefresh={() => void task(() => refresh())}
      onActivate={() => void activate()}
      onLock={() => {
        onLock?.();
        setAccount(null);
        setStatus(null);
        setStored(true);
      }}
    />
  );
}
