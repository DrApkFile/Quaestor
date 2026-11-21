import '../../../apps/web/src/spikeApi.js';
import { chromium } from '@playwright/test';
import { z } from 'zod';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const m2Root = fileURLToPath(new URL('../../../', import.meta.url));
const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));
import { writePrivateJson } from '../src/storage.js';
const label = z
  .string()
  .regex(/^[a-z0-9-]+$/)
  .parse(process.argv[3] ?? 'initial');
const path = `${m2Root}/evidence/m5-browser-spike-${label}.json`;
if (existsSync(path)) throw new Error('SPIKE_LABEL_EXISTS');
const business = z
  .object({ cosmos: z.string().startsWith('qor1') })
  .passthrough()
  .parse(readJson(`${m2Root}/.accounts/business.json`));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors: string[] = [];
page.on('pageerror', (error) => {
  errors.push(error.message);
});
let results: unknown = null;
let errorCode: string | null = null;
try {
  await page.goto(`http://127.0.0.1:5173/spike.html${label.startsWith('relay') ? '?relay=1' : ''}`);
  await page.waitForFunction(() => 'quaestorSpike' in window, {}, { timeout: 120000 });
  results = await page.evaluate(async (address: string) => {
    const api = window.quaestorSpike;
    const cors = await api.cors(address);
    const crypto = await api.crypto();
    return { cors, crypto };
  }, business.cosmos);
} catch (error: unknown) {
  errorCode = error instanceof Error ? error.name : 'SPIKE_FAILED';
}
await browser.close();
const evidence = {
  command: `pnpm evidence --m5-browser-spike ${label}`,
  at: new Date().toISOString(),
  origin: 'http://127.0.0.1:5173',
  status: errorCode ? 'FAILED' : 'COMPLETED',
  errorCode,
  browserErrors: errors.map((text) => text.replace(/0x[\da-fA-F]{40,}/g, '[hex]').slice(0, 240)),
  results,
};
writePrivateJson(path, evidence);
console.log(JSON.stringify(evidence, null, 2));
if (errorCode) process.exitCode = 1;
