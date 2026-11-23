import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { m9Privacy } from './m9Privacy.js';
import { m9Screens } from './m9Screens.js';
import { demoAuditorPassphrase } from '../src/demo.js';
const legacy = z
  .object({ demo: z.object({ honest: z.string() }).passthrough() })
  .passthrough()
  .parse(JSON.parse(readFileSync('../../config/m5.json', 'utf8')) as unknown);
test('A12 M9 auditor retry follows the corrected backup and book instead of a previous demo identity', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext(),
    monitor = m9Privacy(context, []);
  await monitor.start();
  const page = await context.newPage();
  let status = 'FAILED',
    failure: string | null = null;
  try {
    await page.goto('/app?view=auditor&demo=1');
    await expect(page.getByTestId('entry-verdict')).toHaveCount(5, { timeout: 600000 });
    await page.getByText('Use your own auditor backup', { exact: true }).click();
    await page.getByLabel('Audit book ID', { exact: true }).fill(legacy.demo.honest);
    await page.getByLabel('Encrypted backup file', { exact: true }).setInputFiles('public/demo-auditor.json');
    await page.getByLabel('Backup passphrase', { exact: true }).fill('incorrect-demo-passphrase');
    await page.getByRole('button', { name: 'Open granted period', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('passphrase', { timeout: 60000 });
    await page.getByLabel('Backup passphrase', { exact: true }).fill(demoAuditorPassphrase);
    await page.getByRole('button', { name: 'Retry check', exact: true }).click();
    await expect(page.getByTestId('entry-verdict')).toHaveCount(3, { timeout: 600000 });
    await expect(page.getByTestId('audit-results')).toHaveAttribute('data-book', legacy.demo.honest);
    for (const badge of await page.getByTestId('entry-verdict').all())
      await expect(badge).toHaveAttribute('data-code', 'MATCHED');
    await m9Screens(page, 'after', 'auditor-manual-retry');
    status = 'PASSED';
  } catch (error: unknown) {
    failure = error instanceof Error ? error.name : 'FAILED';
  }
  const network = await monitor.finish();
  if (network.leaks || network.errors.length || network.pendingInspections || network.requests !== network.responses)
    status = 'FAILED';
  writeFileSync(
    '../../evidence/m9-manual-retry.json',
    JSON.stringify(
      {
        command: 'pnpm evidence --m9-manual-retry',
        origin: baseURL,
        status,
        failure,
        at: new Date().toISOString(),
        expectedPreviousDemoEntries: 5,
        expectedCorrectedBook: legacy.demo.honest,
        expectedEntries: 3,
        network,
      },
      null,
      2,
    ) + '\n',
  );
  await context.close();
  expect(status).toBe('PASSED');
});
