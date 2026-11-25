import { expect, type Page } from '@playwright/test';
import { writeFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { parseEther, formatEther } from 'viem';
import { z } from 'zod';
import { m9ActivationReceipts } from './m9Driver.js';
import { m10Attempt } from './m10Attempt.js';
import { fundingWaitMs, fundingReminderMs, waitForM10Funding } from './m10Funding.js';
export async function m10Fund(page: Page, address: string | null) {
  const attempt = m10Attempt();
  const publicAddress = z
    .string()
    .regex(/^qor1[a-z0-9]+$/)
    .parse(address);
  const startedAt = Date.now();
  const target = '../../evidence/m10-funding-needed.json';
  const directory = `../../evidence/m10-signup-attempts/${attempt.id}`;
  mkdirSync(directory, { recursive: true });
  if (existsSync(target)) copyFileSync(target, target.replace('.json', `-attempt-${String(startedAt)}.json`));
  const record =
    JSON.stringify(
      {
        command: 'pnpm evidence --m10-fresh-signup',
        attemptId: attempt.id,
        sourceCommit: attempt.sourceCommit,
        address: publicAddress,
        stage: 'WAITING_FOR_BUILDER_FAUCET',
        timeoutSeconds: fundingWaitMs / 1000,
        reminderSeconds: fundingReminderMs / 1000,
        at: new Date(startedAt).toISOString(),
        deadlineAt: new Date(startedAt + fundingWaitMs).toISOString(),
        refusalMarker: `.accounts/m10-browser/attempts/${attempt.id}/faucet-refused`,
      },
      null,
      2,
    ) + '\n';
  writeFileSync(`${directory}/funding-needed.json`, record, { flag: 'wx' });
  writeFileSync(target, record);
  await waitForM10Funding(
    publicAddress,
    {
      now: Date.now,
      refused: () => existsSync(`${attempt.directory}/faucet-refused`),
      funded: async () => {
        const value = await page.getByTestId('funding-balance').textContent();
        const amount = value?.match(/Public balance: ([\d.]+) QOR/)?.[1];
        return amount !== undefined && parseEther(amount) >= parseEther('3.05');
      },
      sleep: (ms) => page.waitForTimeout(ms),
      notify: (message) => {
        console.log(message);
      },
    },
    startedAt,
  );
}
export async function m10Activate(page: Page) {
  const ready = page.getByRole('heading', { name: 'Ready for private payments', exact: true }).first();
  if (await ready.isVisible()) return { activation: await m9ActivationReceipts(page), cost: null, ms: null };
  const button = page.getByRole('button', { name: /Activate quantum-safe account|Retry activation/, exact: true });
  await expect(button).toBeEnabled({ timeout: 60000 });
  const before = await page.getByTestId('funding-balance').textContent();
  const started = Date.now();
  await button.click();
  await expect(ready.or(page.getByRole('alert').filter({ visible: true }))).toBeVisible({ timeout: 300000 });
  await expect(ready).toBeVisible();
  const ms = Date.now() - started;
  await expect(page.getByTestId('activation-receipt')).toHaveCount(4, { timeout: 30000 });
  const activation = await m9ActivationReceipts(page),
    after = await page.getByTestId('funding-balance').textContent();
  const amount = (text: string | null) =>
    parseEther(z.string().parse(text?.match(/Public balance: ([\d.]+) QOR/)?.[1]));
  return { activation, cost: formatEther(amount(before) - amount(after)), ms };
}
