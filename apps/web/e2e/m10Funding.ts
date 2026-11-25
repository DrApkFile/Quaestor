export const fundingWaitMs = 60 * 60 * 1000;
export const fundingReminderMs = 2 * 60 * 1000;
export const fundingPollMs = 10 * 1000;
export const signupTimeoutMs = fundingWaitMs + 30 * 60 * 1000;
interface FundingObserver {
  funded(): Promise<boolean>;
  refused(): boolean;
  sleep(ms: number): Promise<void>;
  notify(message: string): void;
  now(): number;
}
export async function waitForM10Funding(address: string, observer: FundingObserver, startedAt = observer.now()) {
  const deadline = startedAt + fundingWaitMs;
  let nextReminder = startedAt + fundingReminderMs;
  observer.notify(
    `\n${'='.repeat(64)}\nM10 MANUAL FAUCET FUNDING REQUIRED — NEW ACCOUNT\n\n${address}\n\nhttps://dashboard.qorechain.io/faucet\nWaiting up to 60 minutes. Address reminders every 2 minutes.\n${'='.repeat(64)}\n`,
  );
  while (observer.now() < deadline) {
    if (observer.refused()) throw new Error('FAUCET_REFUSED_STOP');
    if (await observer.funded()) return;
    if (observer.now() >= nextReminder) {
      observer.notify(
        `M10 FAUCET REMINDER — ${String(Math.floor((observer.now() - startedAt) / 60000))}/60 minutes elapsed — ${address}`,
      );
      nextReminder = observer.now() + fundingReminderMs;
    }
    const remaining = deadline - observer.now();
    if (remaining <= 0) break;
    await observer.sleep(Math.min(fundingPollMs, remaining));
  }
  throw new Error('MANUAL_FAUCET_TIMEOUT');
}
