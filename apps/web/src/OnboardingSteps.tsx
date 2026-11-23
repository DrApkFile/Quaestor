import { formatEther } from 'viem';
import type { onboardingStatus } from './onboarding.js';
import { activationLabels, type ActivationStage } from './activation.js';
import { Hash } from './Hash.js';
interface Props {
  address: string;
  status: Awaited<ReturnType<typeof onboardingStatus>> | null;
  busy: boolean;
  backup: boolean;
  stage: ActivationStage | null;
  failed: boolean;
  onActivate: () => void;
}
export function OnboardingSteps({ address, status, busy, backup, stage, failed, onActivate }: Props) {
  const ready = status?.pqRegistered && status.kemRegistered && status.cardPublished && status.keysMatch;
  return (
    <div className="grid">
      <section className="panel">
        <h2>Fund your account</h2>
        <p>Your QoreChain address</p>
        <p className="hash" data-testid="funding-address">
          {address}
        </p>
        <Hash value={address} />
        <p data-testid="funding-balance">Public balance: {status ? formatEther(BigInt(status.balance)) : '…'} QOR</p>
        <a href="https://dashboard.qorechain.io/faucet" target="_blank" rel="noreferrer">
          Get free test QOR
        </a>
        <p>Get free test QOR (one claim per 24 hours). This page updates when it arrives.</p>
        <p className="muted">
          Allow up to 1.05 QOR for setup: three native fees of 0.1 QOR plus a card transaction budget of 0.75 QOR.
          Actual cost depends on gas used. Keep another 2 QOR for your first deposit.
        </p>
        {!status?.funded && <p role="status">Checking for funding every 10 seconds…</p>}
      </section>
      <section className="panel">
        <h2>{ready ? 'Account ready.' : 'Activate your account'}</h2>
        <p>
          One-time setup. It lets people pay you privately, and keeps your account safe even from future quantum
          computers.
        </p>
        <p className="muted">The pool’s Groth16 payment proofs remain classical.</p>
        {!ready && (
          <button disabled={busy || !backup || !status?.funded || !status.keysMatch} onClick={onActivate}>
            {failed ? 'Retry activation' : 'Activate quantum-safe account'}
          </button>
        )}
        {stage !== null && (
          <div role="status">
            <p>{activationLabels[stage]}</p>
            <progress aria-label="Account activation" value={ready ? 3 : stage} max={3} />
            <p>
              {ready
                ? 'Setup complete. You can now pay and receive privately.'
                : failed
                  ? 'Setup paused. Retry resumes from confirmed chain state.'
                  : 'Waiting for chain confirmation… usually 10–60 s per step. Keep this tab open.'}
            </p>
          </div>
        )}
        {ready && <p className="badge good">Ready for private payments</p>}
        <details>
          <summary>Details</summary>
          <p>ML-DSA-87 signature: {status?.pqRegistered ? 'registered with possession proven' : 'pending'}.</p>
          <p>ML-KEM-1024 encryption: {status?.kemRegistered ? 'registered' : 'pending'}.</p>
          <p>
            {status?.cardPublished
              ? 'Verified card found on BlobBoard.'
              : 'Recipient card pending; a gas-budgeted EVM window opens before publication.'}
          </p>
          <p>Chain state checked at block {status?.block ?? '…'}. Completed steps are skipped on retry.</p>
        </details>
      </section>
    </div>
  );
}
