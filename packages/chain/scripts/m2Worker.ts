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
export async function runM2Worker(roleInput: unknown, commitmentInput: unknown, memoHashInput: unknown, run = 'm2') {
  const role = z.enum(['supplier1', 'client']).parse(roleInput);
  const commitment = hexSchema.parse(commitmentInput);
  const memoHash = hexSchema.parse(memoHashInput);
  const context = await m2Context(role, run);
  const { journal, reader, config, poolAbi, sealKeys, account } = context;
  const resultPath = `${m2Root}/.accounts/${run}/${role}-result.json`;
  if (existsSync(resultPath)) throw new Error('WORKER_ALREADY_COMPLETE');
  const empty = journal.read().notes.length === 0 && journal.read().operations.length === 0;
  if (!empty) throw new Error('FRESH_RECIPIENT_JOURNAL_REQUIRED');
  journal.save(journal.read());
  const block = await reader.getBlockNumber({ cacheTime: 0 });
  const memos = await scanMemos(reader, context.memoAbi, context.board, block);
  const synced = await syncPoolTree(reader, config, poolAbi, block);
  const result: WorkerResult = {
    role,
    pid: process.pid,
    loadedAccounts: [role],
    journal: `.accounts/${run}/${role}.json`,
    journalInitiallyEmpty: empty,
    scanBlock: block.toString(),
    memoHash,
    commitment,
    openCode: 'TICKET_INVALID',
    treeIncluded: false,
    treeRoot: null,
    notesAfterScan: 0,
    scanErrors: [],
    unshield: null,
    window: null,
    before: null,
    after: null,
    balanceMatched: null,
  };
  const saveProgress = () => {
    const output = workerSchema.parse(result);
    assertPublic(output, [
      ...accountSecrets(account),
      ...sealSecrets(sealKeys),
      ...journal.read().notes.map((note) => note.secret),
    ]);
    writePrivateJson(`${m2Root}/.accounts/${run}/${role}-progress.json`, output);
  };
  let found = false;
  for (const memo of memos) {
    const opened = await receiveMemo(journal, memo, sealKeys, config.pool, block, async (leaf, nullifier, atBlock) => {
      const spent = await reader.readContract({
        address: config.pool,
        abi: poolAbi,
        functionName: 'isSpent',
        args: [nullifier],
        blockNumber: atBlock,
      });
      if (typeof spent !== 'boolean') throw new Error('SPEND_STATUS_INVALID');
      return { included: synced.tree.indexByCommitment.has(leaf.toLowerCase()), spent, root: synced.tree.root };
    });
    if (opened.kind === 'REFUSED' && opened.code !== 'NOT_A_RECIPIENT' && opened.code !== 'DECRYPTION_FAILED')
      result.scanErrors.push({ commitment: memo.commitment, code: opened.code });
    if (
      memo.commitment.toLowerCase() === commitment.toLowerCase() &&
      memo.hash.toLowerCase() === memoHash.toLowerCase()
    ) {
      found = true;
      result.openCode = opened.kind === 'OPENED' ? 'OPENED' : opened.code;
      if (opened.kind === 'OPENED') {
        result.treeIncluded = true;
        result.treeRoot = opened.root;
      }
    }
  }
  result.notesAfterScan = journal.read().notes.length;
  saveProgress();
  if (!found) throw new Error('MEMO_NOT_FOUND');
  if (role === 'supplier1') {
    if (result.openCode !== 'OPENED' || !result.treeIncluded) throw new Error('TICKET_INVALID');
    const window = await openWindow(config, account, 1n, 750000n);
    result.window = { role, action: 'open-window', ...window.transaction };
    saveProgress();
    if (window.status.kind !== 'OPEN') throw new Error('WINDOW_CLOSED');
    const balanceBlock = await reader.getBlockNumber({ cacheTime: 0 });
    const address = account.evm as `0x${string}`;
    result.before = {
      block: balanceBlock.toString(),
      wei: (await reader.getBalance({ address, blockNumber: balanceBlock })).toString(),
    };
    saveProgress();
    const outcome = await context.pool.unshield('m2-unshield', commitment, address);
    if (outcome.kind !== 'LANDED') throw new Error(outcome.kind);
    result.unshield = paymentEvidence(outcome.operation);
    saveProgress();
    const afterBlock = await reader.getBlockNumber({ cacheTime: 0 });
    result.after = {
      block: afterBlock.toString(),
      wei: (await reader.getBalance({ address, blockNumber: afterBlock })).toString(),
    };
    const expected =
      BigInt(journal.read().notes.find((note) => note.commitment === commitment)?.amountWei ?? '0') -
      BigInt(result.unshield.feeWei) -
      BigInt(result.unshield.gasUsed) * BigInt(result.unshield.effectiveGasPrice);
    result.balanceMatched = BigInt(result.after.wei) - BigInt(result.before.wei) === expected;
    if (!result.balanceMatched) throw new Error('BALANCE_MISMATCH');
  } else if (
    result.openCode !== (run === 'm2' ? 'NOT_A_RECIPIENT' : 'DECRYPTION_FAILED') ||
    result.notesAfterScan !== 0
  )
    throw new Error('OUTSIDER_REFUSAL_REQUIRED');
  const output = workerSchema.parse(result);
  assertPublic(output, [
    ...accountSecrets(account),
    ...sealSecrets(sealKeys),
    ...journal.read().notes.map((note) => note.secret),
  ]);
  writePrivateJson(resultPath, output);
  return output;
}
