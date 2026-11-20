import { existsSync } from 'node:fs';
import { z } from 'zod';
import { scanMemos } from '../src/tickets/memoBoard.js';
import { receiveMemo } from '../src/tickets/receive.js';
import { syncPoolTree } from '../src/tree.js';
import { openWindow } from '../src/window.js';
import { paymentEvidence } from '../src/evidence.js';
import { accountSecrets } from '../src/nativeError.js';
import { sealSecrets } from '../src/tickets/sealKeys.js';
import { hexSchema } from '../src/config.js';
import { writePrivateJson } from '../src/storage.js';
import { m2Context, m2Root } from './m2Context.js';
import { assertPublic, workerSchema, type WorkerResult } from './m2Evidence.js';

export async function runM2Worker(roleInput: unknown, commitmentInput: unknown, memoHashInput: unknown) {
  const role = z.enum(['supplier1', 'client']).parse(roleInput);
  const commitment = hexSchema.parse(commitmentInput);
  const memoHash = hexSchema.parse(memoHashInput);
  const context = await m2Context(role);
  const { journal, reader, config, poolAbi, sealKeys, account } = context;
  const resultPath = `${m2Root}/.accounts/m2/${role}-result.json`;
  if (existsSync(resultPath)) throw new Error('WORKER_ALREADY_COMPLETE');
  const empty = journal.read().notes.length === 0 && journal.read().operations.length === 0;
  if (!empty) throw new Error('FRESH_RECIPIENT_JOURNAL_REQUIRED');
  journal.save(journal.read());
  const block = await reader.getBlockNumber({ cacheTime: 0 });
  const memos = await scanMemos(reader, context.memoAbi, context.board, block);
  const synced = await syncPoolTree(reader, config, poolAbi, block);
  const result: WorkerResult = { role, pid: process.pid, loadedAccounts: [role], journal: `.accounts/m2/${role}.json`,
    journalInitiallyEmpty: empty, scanBlock: block.toString(), memoHash, commitment, openCode: 'TICKET_INVALID',
    treeIncluded: false, treeRoot: null, notesAfterScan: 0, scanErrors: [], unshield: null, window: null,
    before: null, after: null, balanceMatched: null };
  let found = false;
  for (const memo of memos) {
    const opened = await receiveMemo(journal, memo, sealKeys, config.pool, block, async (leaf, nullifier, atBlock) => {
      const spent = await reader.readContract({ address: config.pool, abi: poolAbi, functionName: 'isSpent', args: [nullifier], blockNumber: atBlock });
      if (typeof spent !== 'boolean') throw new Error('SPEND_STATUS_INVALID');
      return { included: synced.tree.indexByCommitment.has(leaf.toLowerCase()), spent, root: synced.tree.root };
    });
    if (opened.kind === 'REFUSED' && opened.code !== 'NOT_A_RECIPIENT') result.scanErrors.push({ commitment: memo.commitment, code: opened.code });
    if (memo.commitment.toLowerCase() === commitment.toLowerCase() && memo.hash.toLowerCase() === memoHash.toLowerCase()) {
      found = true;
      result.openCode = opened.kind === 'OPENED' ? 'OPENED' : opened.code;
      if (opened.kind === 'OPENED') { result.treeIncluded = true; result.treeRoot = opened.root; }
    }
  }
  if (!found) throw new Error('MEMO_NOT_FOUND');
  result.notesAfterScan = journal.read().notes.length;
  if (role === 'supplier1') {
    if (result.openCode !== 'OPENED' || !result.treeIncluded) throw new Error('TICKET_INVALID');
    const window = await openWindow(config, account, 1n, 750_000n);
    result.window = { role, action: 'open-window', ...window.transaction };
    if (window.status.kind !== 'OPEN') throw new Error('WINDOW_CLOSED');
    const balanceBlock = await reader.getBlockNumber({ cacheTime: 0 });
    const address = account.evm as `0x${string}`;
    result.before = { block: balanceBlock.toString(), wei: (await reader.getBalance({ address, blockNumber: balanceBlock })).toString() };
    const outcome = await context.pool.unshield('m2-unshield', commitment, address);
    if (outcome.kind !== 'LANDED') throw new Error(outcome.kind);
    result.unshield = paymentEvidence(outcome.operation);
    const afterBlock = await reader.getBlockNumber({ cacheTime: 0 });
    result.after = { block: afterBlock.toString(), wei: (await reader.getBalance({ address, blockNumber: afterBlock })).toString() };
    const expected = 2_000_000_000_000_000_000n - BigInt(result.unshield.feeWei)
      - BigInt(result.unshield.gasUsed) * BigInt(result.unshield.effectiveGasPrice);
    result.balanceMatched = BigInt(result.after.wei) - BigInt(result.before.wei) === expected;
    if (!result.balanceMatched) throw new Error('BALANCE_MISMATCH');
  } else if (result.openCode !== 'NOT_A_RECIPIENT' || result.notesAfterScan !== 0) throw new Error('OUTSIDER_REFUSAL_REQUIRED');
  const output = workerSchema.parse(result);
  assertPublic(output, [...accountSecrets(account), ...sealSecrets(sealKeys), ...journal.read().notes.map(note => note.secret)]);
  writePrivateJson(resultPath, output);
  return output;
}
