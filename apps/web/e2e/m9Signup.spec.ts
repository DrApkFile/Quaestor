import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { m9Fund, m9Activate } from './m9Activation.js';
import { m9Privacy } from './m9Privacy.js';
import { m9Screens } from './m9Screens.js';
import { m9Fixtures } from './m9Fixtures.js';
import { m9Action, m9Navigate, m9Download, m9Snapshot, m9ActivationReceipts, m9SaveBackup } from './m9Driver.js';
test('T-NOPLAIN-WEB M9 fresh signup activates deposits pays and receives through the live UI', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(2700000);
  if (baseURL !== 'https://use-quaestor.vercel.app') throw new Error('LIVE_ORIGIN_REQUIRED');
  const directory = '../../.accounts/m9-browser';
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const sessionFile = `${directory}/signup-session.json`;
  const resume = process.env.QUAESTOR_M9_RESUME === '1';
  if (!resume && existsSync(sessionFile)) throw new Error('EXISTING_SIGNUP_USE_EXPLICIT_RESUME');
  const session = resume
    ? z
        .object({ password: z.string() })
        .strict()
        .parse(JSON.parse(readFileSync(sessionFile, 'utf8')) as unknown)
    : { password: randomBytes(32).toString('base64url') };
  writeFileSync(sessionFile, JSON.stringify(session), { mode: 0o600 });
  const fixture = m9Fixtures(),
    supplier = fixture.roles.supplier1;
  if (!supplier || supplier.address !== 'qor1uz3zu3883m06vcguymnkxema9uantwxn8dmmw2')
    throw new Error('SUPPLIER_FIXTURE_REQUIRED');
  const context = await browser.newContext(),
    supplierContext = await browser.newContext();
  const monitor = m9Privacy(context, [session.password, fixture.password]),
    otherMonitor = m9Privacy(supplierContext, [session.password, fixture.password]);
  await monitor.start();
  await otherMonitor.start();
  const page = await context.newPage(),
    other = await supplierContext.newPage();
  const steps: { step: string; ms: number }[] = [],
    screens: Awaited<ReturnType<typeof m9Screens>> = [];
  let stage = 'CREATE_ACCOUNT',
    address: string | null = null,
    status = 'FAILED',
    failure: string | null = null;
  let failureMessage: string | null = null;
  let activation: Awaited<ReturnType<typeof m9ActivationReceipts>> = [],
    activationCostQor: string | null = null;
  let snapshot: Awaited<ReturnType<typeof m9Snapshot>> | null = null,
    received: Awaited<ReturnType<typeof m9Snapshot>> | null = null;
  const step = async (label: string, work: () => Promise<void>) => {
    stage = label;
    const start = Date.now();
    await work();
    steps.push({ step: label, ms: Date.now() - start });
    console.log(`M9 ${label} completed in ${String(Date.now() - start)} ms`);
  };
  try {
    await step('CREATE_ACCOUNT', async () => {
      await page.goto('/app?view=account');
      screens.push(...(await m9Screens(page, 'after', 'signup-empty')));
      await page.getByLabel('Passphrase', { exact: true }).fill(session.password);
      if (resume)
        await page
          .getByLabel('Restore encrypted backup', { exact: true })
          .setInputFiles(`${directory}/signup-backup.json`);
      else await page.getByRole('button', { name: 'Create account', exact: true }).click();
      await m9Download(page, `${directory}/signup-backup.json`);
      chmodSync(`${directory}/signup-backup.json`, 0o600);
      address = await page.getByTestId('funding-address').textContent();
      if (!address || !/^qor1[a-z0-9]+$/.test(address)) throw new Error('ADDRESS_REQUIRED');
      screens.push(...(await m9Screens(page, 'after', 'signup-funding')));
    });
    await step('WAIT_FOR_MANUAL_FAUCET', () => m9Fund(page, address));
    await step('ACTIVATE', async () => {
      const result = await m9Activate(page);
      activation = result.activation;
      activationCostQor = result.cost;
      screens.push(...(await m9Screens(page, 'after', 'signup-activated')));
      await m9SaveBackup(page, `${directory}/signup-backup.json`, session.password);
    });
    await step('SUPPLIER_CONTEXT', async () => {
      await other.goto('/app?view=account');
      await other.getByLabel('Passphrase', { exact: true }).fill(fixture.password);
      await other.getByLabel('Restore encrypted backup', { exact: true }).setInputFiles(supplier.backup);
      await m9Download(other, `${directory}/supplier-backup.json`);
      await m9Navigate(other, 'Receive');
      const start = other.getByRole('button', { name: 'Start at current block (fresh demo)', exact: true });
      if (!resume && (await start.count())) await m9Action(other, 'Start at current block (fresh demo)');
    });
    await step('DEPOSIT_2_QOR', async () => {
      await m9Navigate(page, 'Wallet');
      if (
        (await m9Snapshot(page)).operations.some(
          (operation) => operation.stage === 'BROADCAST' || operation.stage === 'OUTCOME_UNKNOWN',
        )
      )
        await m9Action(page, 'Resolve held transactions by hash');
      if ((await m9Snapshot(page)).transactions.some((transaction) => transaction.id.startsWith('deposit-'))) return;
      await m9Action(page, 'Prepare to transact');
      await page.getByLabel('Deposit amount', { exact: true }).fill('2');
      await m9Action(page, 'Deposit privately');
      screens.push(...(await m9Screens(page, 'after', 'signup-deposited')));
      await m9SaveBackup(page, `${directory}/signup-backup.json`, session.password);
    });
    await step('PAY_0_5_QOR', async () => {
      await m9Navigate(page, 'Pay');
      if (
        (await m9Snapshot(page)).payments.some(
          (payment) => payment.direction === 'OUT' && payment.stage === 'TICKET_POSTED',
        )
      ) {
        snapshot = await m9Snapshot(page);
        return;
      }
      await page.getByLabel('Recipient qor1 address', { exact: true }).fill(supplier.address);
      await page.getByLabel('Payment amount', { exact: true }).fill('0.5');
      const existing = page.getByRole('button', { name: 'Resume existing payment', exact: true });
      if (await existing.count()) await m9Action(page, 'Resume existing payment');
      else await m9Action(page, 'Prove and pay');
      snapshot = await m9Snapshot(page);
      expect(
        snapshot.payments.filter((payment) => payment.direction === 'OUT' && payment.stage === 'TICKET_POSTED'),
      ).toHaveLength(1);
      screens.push(...(await m9Screens(page, 'after', 'signup-paid')));
      await m9SaveBackup(page, `${directory}/signup-backup.json`, session.password);
    });
    await step('RECEIVE_CHECKED_TICKET', async () => {
      await m9Action(other, 'Scan memo board');
      received = await m9Snapshot(other);
      const outgoing = (await m9Snapshot(page)).payments.find((payment) => payment.direction === 'OUT');
      expect(
        received.payments.some((payment) => payment.direction === 'IN' && payment.commitment === outgoing?.commitment),
      ).toBe(true);
      await expect(other.getByRole('heading', { name: '0.5 QOR', exact: true }).last()).toBeVisible();
      screens.push(...(await m9Screens(other, 'after', 'signup-received')));
    });
    status = 'PASSED';
  } catch (error: unknown) {
    failure = error instanceof Error ? error.name : 'FAILED';
    failureMessage =
      (await page.getByRole('alert').filter({ visible: true }).allTextContents()).join(' ') ||
      (stage === 'WAIT_FOR_MANUAL_FAUCET'
        ? 'Manual faucet funding did not arrive within the timeout.'
        : 'The UI did not reach the expected state.');
    if (await page.evaluate(() => !!window.quaestorM6).catch(() => false))
      await m9SaveBackup(page, `${directory}/signup-backup.json`, session.password).catch(() => undefined);
  }
  const network = await monitor.finish(),
    supplierNetwork = await otherMonitor.finish();
  for (const result of [network, supplierNetwork])
    if (result.leaks || result.errors.length || result.pendingInspections || result.requests !== result.responses)
      status = 'FAILED';
  if (
    screens.some(
      (screen) =>
        !screen.fits || screen.violations.some((violation) => ['serious', 'critical'].includes(violation.impact)),
    )
  ) {
    status = 'FAILED';
    failureMessage = 'A responsive or accessibility check failed.';
  }
  const target = '../../evidence/m9-fresh-signup.json';
  if (existsSync(target)) copyFileSync(target, `../../evidence/m9-fresh-signup-attempt-${String(Date.now())}.json`);
  writeFileSync(
    target,
    JSON.stringify(
      {
        command: 'pnpm evidence --m9-fresh-signup',
        origin: baseURL,
        at: new Date().toISOString(),
        status,
        stage,
        failure,
        failureMessage,
        address,
        freshBrowserContexts: true,
        resumedOriginalSignup: resume,
        steps,
        activation,
        activationCostQor,
        snapshot,
        received,
        network,
        supplierNetwork,
        screens,
        doesNotEstablish: [
          'arbitrary browser or extension safety',
          'unknown secret encodings',
          'post-quantum Groth16',
          'fUSD or cash-out browser privacy',
          'metadata privacy',
          'bookkeeping completeness',
        ],
      },
      null,
      2,
    ) + '\n',
  );
  await context.close();
  await supplierContext.close();
  expect(status, `Fresh signup stopped at ${stage}`).toBe('PASSED');
});
