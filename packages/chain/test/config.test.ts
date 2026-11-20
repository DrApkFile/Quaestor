import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parseConfig } from '../src/config.js';

it('T-CONFIG rejects a missing pool address at startup', () => {
  const body: unknown = JSON.parse(readFileSync(new URL('../../../config/diana.json', import.meta.url), 'utf8'));
  const config = parseConfig(body);
  expect(config.chainId).toBe(9800);
  const { pool: discarded, ...missing } = config;
  expect(discarded).toMatch(/^0x/);
  expect(() => parseConfig({ ...missing, deployBlock: '10427515', chunkSize: '10000' })).toThrow();
});
