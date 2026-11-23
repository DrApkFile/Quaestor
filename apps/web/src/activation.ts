import type { UnifiedAccount } from '@qorechain/sdk';
import type { onboardingStatus, registerPQ, registerKEM, publishCard } from './onboarding.js';
import type { activationReceipts } from './activationReceipts.js';
export const activationLabels = [
  'Securing your account with a quantum-safe signature (1/3)',
  'Publishing your quantum-safe encryption key, so people can pay you privately (2/3)',
  'Publishing your payment card (3/3)',
] as const;
export type ActivationStage = 0 | 1 | 2;
export interface ActivationActions {
  status: typeof onboardingStatus;
  pq: typeof registerPQ;
  kem: typeof registerKEM;
  card: typeof publishCard;
}
async function defaultActions(): Promise<ActivationActions> {
  const { onboardingStatus, registerPQ, registerKEM, publishCard } = await import('./onboarding.js');
  return { status: onboardingStatus, pq: registerPQ, kem: registerKEM, card: publishCard };
}
export async function activateAccount(
  account: UnifiedAccount,
  backup: boolean,
  progress: (stage: ActivationStage, status: Awaited<ReturnType<typeof onboardingStatus>>) => void,
  actions?: ActivationActions,
  record?: typeof activationReceipts,
) {
  if (!backup) throw new Error('BACKUP_REQUIRED');
  const steps: ActivationActions = actions ?? (await defaultActions());
  const keepReceipt = record ?? (await import('./activationReceipts.js')).activationReceipts;
  for (const stage of [0, 1, 2] as const) {
    await keepReceipt(account.cosmos);
    const status = await steps.status(account);
    if (!status.keysMatch) throw new Error('REGISTRY_KEY_MISMATCH');
    progress(stage, status);
    if (stage === 0 && !status.pqRegistered) await steps.pq(account, backup);
    if (stage === 1 && !status.kemRegistered) {
      if (!status.pqRegistered) throw new Error('REGISTRY_NOT_READY');
      await steps.kem(account, backup);
    }
    if (stage === 2 && !status.cardPublished) {
      if (!status.pqRegistered || !status.kemRegistered) throw new Error('REGISTRY_NOT_READY');
      await steps.card(account, backup);
    }
  }
  await keepReceipt(account.cosmos);
  const status = await steps.status(account);
  if (!status.keysMatch || !status.pqRegistered || !status.kemRegistered || !status.cardPublished)
    throw new Error('REGISTRY_NOT_READY');
  return status;
}
