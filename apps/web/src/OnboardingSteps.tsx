import { formatEther } from 'viem';
import type { onboardingStatus } from './onboarding.js';
import { activationLabels, type ActivationStage } from './activation.js';
import { Hash } from './Hash.js';
import { z } from 'zod';
import rawEstimate from '../public/activation-estimate.json';
import { humanDate } from './presentation.js';
const estimate = z
  .object({
    network: z.literal('qorechain-diana'),
    measuredAt: z.string().datetime(),
    costQor: z.string().regex(/^\d+(\.\d+)?$/),
    estimatedSetupQor: z.string().regex(/^\d+(\.\d+)?$/),
    cardGasUsed: z.string().regex(/^\d+$/),
    source: z.literal('evidence/m9-activation-cost.json'),
  })
  .strict()
  .parse(rawEstimate);
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
        <p className="muted" data-testid="activation-estimate">
          Estimated setup cost: <strong>{estimate.estimatedSetupQor} QOR</strong>, based on real gas and fees with a 25%
          buffer. Keep another 2 QOR for your first deposit.
        </p>
        <details>
          <summary>Fee details</summary>
          <p>
            Measured {humanDate(estimate.measuredAt)}: {estimate.costQor} QOR for signing-key registration,
            encryption-key registration, the window and payment card. The card used {estimate.cardGasUsed} gas.
          </p>
          <p>
            Fees can change. Allow up to 1.05 QOR for setup: three native fees of 0.1 QOR and a card transaction budget
            of 0.75 QOR. Every transaction still checks its estimated gas against the signed window limit.
          </p>
          <a
            href="https://github.com/DrApkFile/Quaestor/blob/master/evidence/m9-activation-cost.json"
            target="_blank"
            rel="noreferrer"
          >
            Observed gas and fee evidence
          </a>
        </details>
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
