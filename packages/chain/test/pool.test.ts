import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { zeroAddress, type PublicClient } from 'viem';
import { createPool } from '../src/pool.js';
import { parseConfig } from '../src/config.js';
import { Journal } from '../src/journal.js';
import { pinnedReader } from '../src/tree.js';
import { fakeGateway } from './fixtures.js';
it('T-WINDOW pool wrapper refuses a shield with a closed window without reading, proving, or broadcasting', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'quaestor-pool-'));
  try {
    const gateway = fakeGateway();
    gateway.windowOpen.mockResolvedValue(false);
    const getBlockNumber = vi.fn(() => Promise.resolve().then(() => 100n));
    const reader = { getBlockNumber } as unknown as PublicClient;
    const config = parseConfig(
      JSON.parse(readFileSync(new URL('../../../config/diana.json', import.meta.url), 'utf8')) as unknown,
    );
    const prover = vi.fn(() => Promise.resolve().then(() => ({ proofBytes: '0xab' as const })));
    const pool = createPool({
      config,
      reader,
      abi: [],
      journal: new Journal(join(directory, 'journal.json')),
      gateway,
      owner: 'business',
      provers: { shield: prover, transfer: prover, unshield: prover },
    });
    expect(await pool.shield('shield', zeroAddress, 5n)).toEqual({ kind: 'WINDOW_CLOSED' });
    expect(getBlockNumber).not.toHaveBeenCalled();
    expect(prover).not.toHaveBeenCalled();
    expect(gateway.broadcast).not.toHaveBeenCalled();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
it('T-CHAIN pins each decision read to the chosen block even when the caller asks for a different height', async () => {
  const readContract = vi.fn(() => Promise.resolve().then(() => 7n));
  const pinned = pinnedReader({ readContract } as unknown as PublicClient, 42n);
  expect(await pinned.getBlockNumber()).toBe(42n);
  await pinned.readContract({ address: zeroAddress, abi: [], functionName: 'currentRoot', blockNumber: 99n });
  expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ blockNumber: 42n }));
});
