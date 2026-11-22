import { existsSync, writeFileSync } from 'node:fs';
import { buildFundsWitness } from '@gloamtrade/sdk';
import { groth16 } from 'snarkjs';
import { EthNativeSigner, openEvmWindowMsg } from '@qorechain/sdk';
import { StargateClient } from '@cosmjs/stargate';
import { sha256, zeroAddress } from 'viem';
import { z } from 'zod';
import { fundsSchema, holdingsContext, verifyProof } from '@quaestor/core';
import { syncPoolTree, requireNotePath } from '../src/tree.js';
import type { StoredNote } from '../src/journalSchema.js';
import { m2Root, type M2Context } from './m2Context.js';
import { readJson } from './m3Shared.js';
export async function proveFundsM7(context: M2Context, notes: StoredNote[], book: `0x${string}`, period: string) {
  const block = await context.reader.getBlockNumber({ cacheTime: 0 });
  const { tree } = await syncPoolTree(context.reader, context.config, context.poolAbi, block);
  const inputs = [];
  for (const note of notes) {
    if (
      await context.reader.readContract({
        address: context.config.pool,
        abi: context.poolAbi,
        functionName: 'spent',
        args: [note.nullifier],
        blockNumber: block,
      })
    )
      throw new Error('NOTE_SPENT');
    inputs.push({
      secretHex: note.secret,
      amount: BigInt(note.amountWei),
      path: await requireNotePath(tree, note.commitment),
    });
  }
  const witness = await buildFundsWitness({
    asset: zeroAddress,
    threshold: 2000000000000000000n,
    context: holdingsContext(book, period, context.config.pool),
    notes: inputs,
  });
  if (witness.blocker) throw new Error('FUNDS_WITNESS_FAILED');
  const base = `${m2Root}/apps/web/public/circuits`;
  const proof = fundsSchema.parse(
    await groth16.fullProve(
      witness.circomInput,
      `${base}/funds.wasm`,
      `${base}/funds_final.zkey`,
      undefined,
      undefined,
      { singleThread: true },
    ),
  );
  if (!(await verifyProof(readJson(`${base}/funds_vkey.json`), proof))) throw new Error('BAD_PROOF');
  return proof;
}
export async function windowM7(context: M2Context, dir: string) {
  const path = `${dir}/window.json`,
    shape = z.object({ raw: z.string(), hash: z.string(), submitted: z.boolean() }).strict();
  let saved;
  if (existsSync(path)) saved = shape.parse(readJson(path));
  else {
    const account = z.object({ account_number: z.string(), sequence: z.string() }).passthrough();
    const response = await fetch(`${context.config.rest}/cosmos/auth/v1beta1/accounts/${context.account.cosmos}`);
    const value = z
      .object({ account: z.union([account, z.object({ base_account: account }).passthrough()]) })
      .passthrough()
      .parse(await response.json());
    const state =
      'base_account' in value.account ? account.parse(value.account.base_account) : account.parse(value.account);
    const signer = new EthNativeSigner(context.account, { signMode: 'hybrid', rest: context.config.rest });
    const tx = signer.sign({
      chainId: context.config.nativeChainId,
      accountNumber: BigInt(state.account_number),
      sequence: BigInt(state.sequence),
      fee: { amount: [{ denom: 'uqor', amount: '100000' }], gas: '800000' },
      messages: [openEvmWindowMsg({ sender: context.account.cosmos, blocks: 600n, maxTxs: 32n, maxValue: 24000000n })],
      signBytesVersion: await signer.resolveSignBytesVersion(context.config.nativeChainId),
    });
    saved = {
      raw: Buffer.from(tx.txRawBytes).toString('base64'),
      hash: sha256(tx.txRawBytes).slice(2).toUpperCase(),
      submitted: false,
    };
    writeFileSync(path, JSON.stringify(saved), { mode: 0o600 });
  }
  const native = await StargateClient.connect(context.config.consensusRpc);
  try {
    if (!saved.submitted) {
      saved.submitted = true;
      writeFileSync(path, JSON.stringify(saved), { mode: 0o600 });
      await native.broadcastTx(Buffer.from(saved.raw, 'base64'), 120000, 2000);
    }
    const receipt = await native.getTx(saved.hash);
    if (!receipt) throw new Error('OUTCOME_UNKNOWN');
    if (receipt.code !== 0) throw new Error('WINDOW_REVERTED');
    return { hash: receipt.hash, height: receipt.height, code: receipt.code };
  } finally {
    native.disconnect();
  }
}
