import { formatEther } from 'viem';
import type { onboardingStatus } from './onboarding.js';
interface Props {
  status: Awaited<ReturnType<typeof onboardingStatus>> | null;
  busy: boolean;
  backup: boolean;
  onAction: (kind: 'pq' | 'kem' | 'card') => void;
}
export function OnboardingSteps({ status, busy, backup, onAction }: Props) {
  return (
    <ol className="steps">
      <li className="panel">
        <div>
          <span className="step-number">1</span>
          <h2>Fund on testnet</h2>
        </div>
        <p>{status ? `${formatEther(BigInt(status.balance))} QOR` : 'Checking balance…'}</p>
        <a href="https://dashboard.qorechain.io/faucet" target="_blank" rel="noreferrer">
          Open the QoreChain faucet ↗
        </a>
      </li>
      <li className="panel">
        <div>
          <span className="step-number">2</span>
          <h2>Register ML-DSA-87</h2>
        </div>
        <p>
          {status?.pqRegistered ? 'Registered with possession proven.' : 'Register the account’s public signing key.'}
        </p>
        <button
          disabled={busy || !backup || !status?.funded || status.pqRegistered || !status.keysMatch}
          onClick={() => {
            onAction('pq');
          }}
        >
          Register signing key
        </button>
      </li>
      <li className="panel">
        <div>
          <span className="step-number">3</span>
          <h2>Register ML-KEM-1024</h2>
        </div>
        <p>
          {status?.kemRegistered ? 'Registered and checked against this backup.' : 'Publish the public encryption key.'}
        </p>
        <button
          disabled={busy || !backup || !status?.pqRegistered || status.kemRegistered || !status.keysMatch}
          onClick={() => {
            onAction('kem');
          }}
        >
          Register encryption key
        </button>
      </li>
      <li className="panel">
        <div>
          <span className="step-number">4</span>
          <h2>Publish recipient card</h2>
        </div>
        <p>
          {status?.cardPublished
            ? 'Verified card found on BlobBoard.'
            : 'Sign a public recipient card and publish it on chain.'}
        </p>
        <button
          disabled={busy || !backup || !status?.kemRegistered || status.cardPublished || !status.keysMatch}
          onClick={() => {
            onAction('card');
          }}
        >
          Sign and publish card
        </button>
      </li>
    </ol>
  );
}
