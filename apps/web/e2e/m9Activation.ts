import { expect, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { parseEther, formatEther } from 'viem';
import { z } from 'zod';
import { m9ActivationReceipts } from './m9Driver.js';
export async function m9Fund(page: Page, address: string | null) {
  console.log(
    `M9 FAUCET FUNDING NEEDED: ${String(address)} — use https://dashboard.qorechain.io/faucet manually. Polling for up to 20 minutes; faucet is never automated.`,
  );
  writeFileSync(
    '../../evidence/m9-funding-needed.json',
    JSON.stringify(
      {
        command: 'pnpm evidence --m9-fresh-signup',
        address,
        stage: 'WAITING_FOR_BUILDER_FAUCET',
        timeoutSeconds: 1200,
        at: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  );
  await expect
    .poll(
      async () => {
        const value = await page.getByTestId('funding-balance').textContent();
        console.log(`M9 Waiting for builder faucet: ${String(address)}; ${String(value)}`);
        return Number(value?.match(/Public balance: ([\d.]+) QOR/)?.[1] ?? '0') >= 3.05;
      },
      { timeout: 1200000, intervals: [10000] },
    )
    .toBe(true);
}
export async function m9Activate(page: Page) {
  const ready = page.getByRole('heading', { name: 'Account ready.', exact: true }).first();
  if (await ready.isVisible()) return { activation: await m9ActivationReceipts(page), cost: null };
  const button = page.getByRole('button', { name: /Activate quantum-safe account|Retry activation/, exact: true });
  await expect(button).toBeEnabled({ timeout: 60000 });
  const before = await page.getByTestId('funding-balance').textContent();
  await button.click();
  await expect(ready.or(page.getByRole('alert').filter({ visible: true }))).toBeVisible({ timeout: 300000 });
  await expect(ready).toBeVisible();
  await expect(page.getByTestId('activation-receipt')).toHaveCount(4, { timeout: 30000 });
  const activation = await m9ActivationReceipts(page),
    after = await page.getByTestId('funding-balance').textContent();
  const amount = (text: string | null) =>
    parseEther(z.string().parse(text?.match(/Public balance: ([\d.]+) QOR/)?.[1]));
  return { activation, cost: formatEther(amount(before) - amount(after)) };
}
