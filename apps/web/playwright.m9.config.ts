import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e',
  testMatch: ['m9*.spec.ts', 'm10*.spec.ts', 'm11*.spec.ts', 'm12*.spec.ts'],
  timeout: 1800000,
  use: { baseURL: process.env.QUAESTOR_M9_ORIGIN ?? 'https://use-quaestor.vercel.app', headless: true },
  workers: 1,
});
