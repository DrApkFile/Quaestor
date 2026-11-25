import { m10Report } from './m10Report.js';
import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { m10Fund, m10Activate } from './m10Activation.js';
import { m9Privacy } from './m9Privacy.js';
import { m10Screens } from './m10Screens.js';
import { m9Fixtures } from './m9Fixtures.js';
import { m9Action, m9Navigate, m9Download, m9Snapshot, m9ActivationReceipts, m9SaveBackup } from './m9Driver.js';
test('T-NOPLAIN-WEB M10 fresh signup activates deposits pays and receives through the live UI', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(2700000);
  if (baseURL !== 'https://use-quaestor.vercel.app') throw new Error('LIVE_ORIGIN_REQUIRED');
  const directory = '../../.accounts/m10-browser';
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const sessionFile = `${directory}/signup-session.json`;
  if (process.env.QUAESTOR_M10_FAUCET_READY !== 'builder-confirmed' || Date.now() < Date.parse('2026-11-24T08:40:00Z'))
    throw new Error('BUILDER_FAUCET_READY_SIGNAL_REQUIRED');
  if (existsSync(sessionFile)) throw new Error('FRESH_SIGNUP_PROFILE_ALREADY_USED');
  const session = { password: randomBytes(32).toString('base64url') };
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
  await page.addLocatorHandler(
    page.getByRole('dialog', { name: 'Open a transaction window', exact: true }),
    async (modal) => {
      await modal.getByRole('button', { name: 'Open window and continue', exact: true }).click();
    },
  );
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const steps: { step: string; ms: number }[] = [],
    screens: Awaited<ReturnType<typeof m10Screens>> = [];
  let stage = 'CREATE_ACCOUNT',
    address: string | null = null,
    status = 'FAILED',
    failure: string | null = null;
  let activationMs: number | null = null;
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
    console.log(`M10 ${label} completed in ${String(Date.now() - start)} ms`);
  };
  try {
    await step('CREATE_ACCOUNT', async () => {
      await page.goto('/app?view=account');
      screens.push(...(await m10Screens(page, 'after', 'signup-empty')));
      await page.getByLabel('Passphrase', { exact: true }).fill(session.password);
      await page.getByRole('button', { name: 'Create account', exact: true }).click();
      await m9Download(page, `${directory}/signup-backup.json`);
      chmodSync(`${directory}/signup-backup.json`, 0o600);
      address = await page.getByTestId('funding-address').textContent();
      if (!address || !/^qor1[a-z0-9]+$/.test(address)) throw new Error('ADDRESS_REQUIRED');
      screens.push(...(await m10Screens(page, 'after', 'signup-funding')));
    });
    await step('WAIT_FOR_MANUAL_FAUCET', () => m10Fund(page, address));
    await step('ACTIVATE', async () => {
      const result = await m10Activate(page);
      activation = result.activation;
      activationCostQor = result.cost;
      activationMs = result.ms;
      screens.push(...(await m10Screens(page, 'after', 'signup-activated')));
      await m9SaveBackup(page, `${directory}/signup-backup.json`, session.password);
    });
    await step('SUPPLIER_CONTEXT', async () => {
      await other.goto('/app?view=account');
      await other.getByLabel('Passphrase', { exact: true }).fill(fixture.password);
      await other.getByLabel('Restore encrypted backup', { exact: true }).setInputFiles(supplier.backup);
      await m9Download(other, `${directory}/supplier-backup.json`);
      await m9Navigate(other, 'Receive');
      const start = other.getByRole('button', { name: 'Start at current block (fresh demo)', exact: true });
      if (await start.count()) await m9Action(other, 'Start at current block (fresh demo)');
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
      await page.getByLabel('Deposit amount', { exact: true }).fill('2');
      await m9Action(page, 'Deposit privately');
      screens.push(...(await m10Screens(page, 'after', 'signup-deposited')));
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
      screens.push(...(await m10Screens(page, 'after', 'signup-paid')));
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
      screens.push(...(await m10Screens(other, 'after', 'signup-received')));
    });
    status = 'PASSED';
  } catch (error: unknown) {
    failure = error instanceof Error ? error.name : 'FAILED';
    failureMessage =
      error instanceof Error && error.message === 'FAUCET_REFUSED_STOP'
        ? 'Builder reported faucet refusal; stopped without alternative funding.'
        : (await page.getByRole('alert').filter({ visible: true }).allTextContents()).join(' ') ||
          (stage === 'WAIT_FOR_MANUAL_FAUCET'
            ? 'Manual faucet funding did not arrive within the timeout.'
            : 'The UI did not reach the expected state.');
    if (await page.evaluate(() => !!window.quaestorM6).catch(() => false))
      await m9SaveBackup(page, `${directory}/signup-backup.json`, session.password).catch(() => undefined);
  }
  await Promise.all([page.waitForLoadState('networkidle'), other.waitForLoadState('networkidle')]);
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
  m10Report({
    origin: baseURL,
    at: new Date().toISOString(),
    startedAt,
    elapsedMs: Date.now() - started,
    status,
    stage,
    failure,
    failureMessage,
    address,
    freshBrowserContexts: true,
    resumedOriginalSignup: false,
    uninterruptedFreshSignup: status === 'PASSED',
    steps,
    activation,
    activationCostQor,
    activationMs,
    snapshot,
    received,
    network,
    supplierNetwork,
    screens,
  });
  await context.close();
  await supplierContext.close();
  expect(status, `Fresh signup stopped at ${stage}`).toBe('PASSED');
});
