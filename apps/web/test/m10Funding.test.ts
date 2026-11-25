import { expect, it } from 'vitest';
import { fundingWaitMs, fundingReminderMs, signupTimeoutMs, waitForM10Funding } from '../e2e/m10Funding.js';
const address = 'qor1fundingtestfixture';
function observer() {
  let time = 0;
  const notices: { time: number; message: string }[] = [];
  return {
    notices,
    now: () => time,
    funded: () => Promise.resolve(false),
    refused: () => false,
    sleep: (ms: number) => {
      time += ms;
      return Promise.resolve();
    },
    notify: (message: string) => {
      notices.push({ time, message });
    },
  };
}
it('A11 a manual faucet claim after the old twenty-minute limit continues the same wait', async () => {
  const clock = observer();
  clock.funded = () => Promise.resolve(clock.now() >= 25 * 60 * 1000);
  await waitForM10Funding(address, clock);
  expect(clock.now()).toBe(25 * 60 * 1000);
  expect(clock.notices[0]?.message).toContain(`\n${address}\n`);
  expect(clock.notices[0]?.message).toContain('up to 60 minutes');
});
it('A11 funding times out at sixty minutes with an address reminder every two minutes', async () => {
  const clock = observer();
  await expect(waitForM10Funding(address, clock)).rejects.toThrow('MANUAL_FAUCET_TIMEOUT');
  expect(clock.now()).toBe(fundingWaitMs);
  expect(clock.notices.slice(1).map(({ time }) => time)).toEqual(
    Array.from({ length: 29 }, (_, index) => (index + 1) * fundingReminderMs),
  );
  expect(clock.notices.every(({ message }) => message.includes(address))).toBe(true);
  expect(signupTimeoutMs).toBeGreaterThan(fundingWaitMs);
});
it('A11 faucet refusal stops immediately without waiting for funding or retrying', async () => {
  const clock = observer();
  clock.refused = () => true;
  await expect(waitForM10Funding(address, clock)).rejects.toThrow('FAUCET_REFUSED_STOP');
  expect(clock.now()).toBe(0);
  expect(clock.notices).toHaveLength(1);
});
