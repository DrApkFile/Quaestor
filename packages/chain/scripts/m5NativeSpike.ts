import '../../../apps/web/src/spikeApi.js';
import { chromium } from '@playwright/test';
import { EthNativeSigner, openEvmWindowMsg } from '@qorechain/sdk';
import { StargateClient } from '@cosmjs/stargate';
import { sha256 } from 'viem';
import { z } from 'zod';
import { existsSync } from 'node:fs';
import { m2Context, m2Root } from './m2Context.js';
import { readJson } from './m3Shared.js';
import { writePrivateJson } from '../src/storage.js';
const output = `${m2Root}/evidence/m5-browser-native.json`;
if (existsSync(output)) throw new Error('NATIVE_SPIKE_EXISTS');
const context = await m2Context('client', 'm5-spike');
const checkpoint = `${m2Root}/.accounts/m5-spike/native.json`;
const schema = z.object({ tx: z.string(), hash: z.string().regex(/^[\dA-F]{64}$/), submitted: z.boolean() }).strict();
let state;
if (existsSync(checkpoint)) state = schema.parse(readJson(checkpoint));
else {
  const seq = z.object({ account_number: z.string(), sequence: z.string() }).passthrough();
  const response = await fetch(`${context.config.rest}/cosmos/auth/v1beta1/accounts/${context.account.cosmos}`);
  const body = z
    .object({ account: z.union([z.object({ base_account: seq }).passthrough(), seq]) })
    .passthrough()
    .parse(await response.json());
  const account = 'base_account' in body.account ? seq.parse(body.account.base_account) : seq.parse(body.account);
  const signer = new EthNativeSigner(context.account, { signMode: 'hybrid', rest: context.config.rest });
  const version = await signer.resolveSignBytesVersion('qorechain-diana');
  const signed = signer.sign({
    chainId: 'qorechain-diana',
    accountNumber: BigInt(account.account_number),
    sequence: BigInt(account.sequence),
    fee: { amount: [{ denom: 'uqor', amount: '100000' }], gas: '800000' },
    messages: [openEvmWindowMsg({ sender: context.account.cosmos, blocks: 100n, maxTxs: 1n, maxValue: 1000000n })],
    signBytesVersion: version,
  });
  state = {
    tx: Buffer.from(signed.txRawBytes).toString('base64'),
    hash: sha256(signed.txRawBytes).slice(2).toUpperCase(),
    submitted: false,
  };
  writePrivateJson(checkpoint, state);
}
let broadcast: unknown = null;
if (!state.submitted) {
  state.submitted = true;
  writePrivateJson(checkpoint, state);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:5173/spike.html?relay=1');
    await page.waitForFunction(() => 'quaestorSpike' in window);
    broadcast = await page.evaluate((tx) => window.quaestorSpike.broadcast(tx), state.tx);
  } finally {
    await browser.close();
  }
}
const client = await StargateClient.connect(context.config.consensusRpc);
let receipt = null;
try {
  for (let i = 0; i < 30; i++) {
    receipt = await client.getTx(state.hash);
    if (receipt) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
} finally {
  client.disconnect();
}
if (!receipt || receipt.code !== 0) throw new Error('NATIVE_BROADCAST_UNCONFIRMED');
const evidence = {
  command: 'pnpm evidence --m5-native-spike',
  at: new Date().toISOString(),
  transport: 'Chromium -> same-origin allowlisted Vercel-compatible pass-through -> consensus RPC',
  signing: 'SDK hybrid eth-native; already-signed bytes only crossed the relay',
  hash: state.hash,
  height: receipt.height,
  gasUsed: receipt.gasUsed.toString(),
  code: receipt.code,
  broadcast,
};
writePrivateJson(output, evidence);
console.log(JSON.stringify(evidence, null, 2));
