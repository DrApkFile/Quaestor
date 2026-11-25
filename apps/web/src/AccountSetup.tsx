import type { UnifiedAccount } from '@qorechain/sdk';
import type { onboardingStatus } from './onboarding.js';
import { activationLabels, type ActivationStage } from './activation.js';
import { OnboardingSteps } from './OnboardingSteps.js';
import { ActivationDetails } from './ActivationDetails.js';
import { errorMessages } from './messages.js';
interface Props {
  account: UnifiedAccount;
  backup: boolean;
  backupPassphrase: string;
  busy: boolean;
  error: string;
  status: Awaited<ReturnType<typeof onboardingStatus>> | null;
  stage: ActivationStage | null;
  failedStage: ActivationStage | null;
  onBackupPassphrase: (value: string) => void;
  onDownload: () => void;
  onRefresh: () => void;
  onLock: () => void;
  onActivate: () => void;
}
export function AccountSetup({
  account,
  backup,
  backupPassphrase,
  busy,
  error,
  status,
  stage,
  failedStage,
  onBackupPassphrase,
  onDownload,
  onRefresh,
  onLock,
  onActivate,
}: Props) {
  return (
    <section>
      <div className="intro">
        <p className="eyebrow">Account</p>
        <h1>Account</h1>
        <p>
          Save your encrypted backup, get test QOR, then activate once. Setup resumes from the chain if interrupted.
        </p>
      </div>
      <div className="panel">
        <h2>Encrypted backup</h2>
        <p>
          {backup ? 'Backup download completed.' : 'Download an encrypted backup before any transaction is enabled.'}
        </p>
        <label>
          Backup passphrase
          <input
            type="password"
            autoComplete="off"
            value={backupPassphrase}
            onChange={(event) => {
              onBackupPassphrase(event.target.value);
            }}
          />
        </label>
        <p>Includes account keys and the encrypted private journal. Download again after payments or booking.</p>
        <button disabled={busy || backupPassphrase.length < 12} onClick={onDownload}>
          Download backup
        </button>
        <dl className="addresses">
          <dt>Native address</dt>
          <dd>{account.cosmos}</dd>
          <dt>EVM address</dt>
          <dd>{account.evm}</dd>
        </dl>
        <div className="actions">
          <button className="secondary" disabled={busy} onClick={onRefresh}>
            Refresh chain state
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              onLock();
            }}
          >
            Lock account
          </button>
        </div>
      </div>
      <OnboardingSteps
        address={account.cosmos}
        status={status}
        busy={busy}
        backup={backup}
        stage={stage}
        failed={failedStage !== null}
        onActivate={onActivate}
      />
      <ActivationDetails address={account.cosmos} busy={busy} />
      {status && !status.keysMatch && (
        <p role="alert" className="error">
          The registered keys do not match this backup. Nothing will be overwritten.
        </p>
      )}
      {error && (
        <p
          role={error === errorMessages.WINDOW_DECLINED ? 'status' : 'alert'}
          className={error === errorMessages.WINDOW_DECLINED ? 'notice' : 'error'}
        >
          {failedStage !== null && <strong>{activationLabels[failedStage]} failed. </strong>}
          {error}
        </p>
      )}
      {busy && (
        <div role="status">
          <progress aria-label="Account operation" />
          <p>Securing local keys or waiting for chain confirmation… usually 10–60 s.</p>
        </div>
      )}
    </section>
  );
}
