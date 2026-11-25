import { existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { IQORE_PQC_ABI } from '@qorechain/evm';
import { pqcSign, pqcVerify } from '@qorechain/sdk';
import { toHex, hexToBytes, encodeFunctionData, zeroHash } from 'viem';
import { closeDigestV2, contractPeriod } from '../packages/core/src/index.js';
import { m12Plan } from './m12-plan.js';
import { m2Context, m2Root } from '../packages/chain/scripts/m2Context.js';
import { readJson, sendCall } from '../packages/chain/scripts/m3Shared.js';
import { loadPoolAbi } from '../packages/chain/src/abi.js';
import { addressSchema, hexSchema } from '../packages/chain/src/config.js';
import { writePrivateJson } from '../packages/chain/src/storage.js';
import { legacyChecks } from './m12-legacy.js';
import { openWindow } from '../packages/chain/src/window.js';
import { readRegistry } from '../packages/chain/src/tickets/kemRegistry.js';
import { blobKindId, assertPublishable } from '../packages/chain/src/blobPayload.js';
import { assertPublic } from '../packages/chain/scripts/m2Evidence.js';
const output = `${m2Root}/evidence/m12-hedged-close.json`;
if (existsSync(output)) throw new Error('M12_CLOSE_ALREADY_RECORDED');
const context = await m2Context('business', 'm12');
const deployment = z
  .object({
    books: z.object({ address: addressSchema }).passthrough(),
    board: z.object({ address: addressSchema }).passthrough(),
  })
  .passthrough()
  .parse(readJson(`${m2Root}/config/m5.json`));
const abi = loadPoolAbi(`${m2Root}/contracts/out/Books.sol/Books.json`);
const boardAbi = loadPoolAbi(`${m2Root}/contracts/out/BlobBoard.sol/BlobBoard.json`);
const plan = m12Plan(context, deployment.books.address);
const digest = closeDigestV2(plan.book, plan.period, 0, zeroHash, plan.close.sha3, 9800n, deployment.books.address);
if (plan.signature === plan.secondSignature) throw new Error('HEDGING_REQUIRED');
const windowPath = `${m2Root}/.accounts/m12/window.json`;
const windowSchema = z.object({ hash: z.string(), height: z.number(), gasUsed: z.string() }).passthrough();
const window = existsSync(windowPath)
  ? windowSchema.parse(readJson(windowPath))
  : (await openWindow(context.config, context.account, 4n, 5_000_000n)).transaction;
writePrivateJson(windowPath, window);
const post = async (kind: 'opening' | 'close', blob: typeof plan.opening) => {
  assertPublishable(kind, hexToBytes(blob.blob));
  return sendCall(context, deployment.board.address, boardAbi, `m12-${kind}-blob`, 'post', [
    blobKindId(kind),
    blob.sha3,
    blob.blob,
  ]);
};
const openingPost = await post('opening', plan.opening);
const register = await sendCall(context, deployment.books.address, abi, 'm12-register', 'registerBook', [
  plan.salt,
  plan.opening.sha3,
]);
const closePost = await post('close', plan.close);
const block = await context.reader.getBlockNumber({ cacheTime: 0 });
const registry = await readRegistry(context.config, context.account.cosmos, block);
if (toHex(registry.pqPublicKey) !== toHex(context.account.pqc.publicKey)) throw new Error('KEY_MISMATCH');
const verify = (signature: typeof plan.signature) =>
  context.reader.readContract({
    address: '0x0000000000000000000000000000000000000a01',
    abi: IQORE_PQC_ABI,
    functionName: 'pqcVerify',
    args: [toHex(registry.pqPublicKey), signature, digest],
    blockNumber: block,
  });
const deterministic = toHex(pqcSign(context.account.pqc.secretKey, hexToBytes(digest)));
const flipped = hexToBytes(plan.signature);
flipped[0] = (flipped[0] ?? 0) ^ 1;
const signatures = [plan.signature, plan.secondSignature, deterministic];
const accepted = await Promise.all(signatures.map(verify));
const flippedRejected = !(await verify(toHex(flipped)));
if (
  accepted.some((value) => !value) ||
  !flippedRejected ||
  signatures.some((value) => !pqcVerify(registry.pqPublicKey, hexToBytes(digest), hexToBytes(value)))
)
  throw new Error('PQC_CHECK_FAILED');
const legacy = await legacyChecks(context, registry.pqPublicKey, block);
const args = [plan.book, contractPeriod(plan.period), 0n, zeroHash, plan.close.sha3, plan.signature];
const data = encodeFunctionData({ abi, functionName: 'closePeriod', args });
await context.reader.call({
  account: addressSchema.parse(context.account.evm),
  to: deployment.books.address,
  data,
  blockNumber: block,
});
const close = await sendCall(context, deployment.books.address, abi, 'm12-close', 'closePeriod', args);
const receipt = await context.reader.getTransactionReceipt({ hash: close.hash });
if (receipt.status !== 'success' || receipt.blockNumber.toString() !== close.blockNumber)
  throw new Error('CLOSE_RECEIPT_FAILED');
const state = z.tuple([z.bigint(), hexSchema, z.boolean(), hexSchema]).parse(
  await context.reader.readContract({
    address: deployment.books.address,
    abi,
    functionName: 'periods',
    args: [plan.book, contractPeriod(plan.period)],
    blockNumber: receipt.blockNumber,
  }),
);
if (!state[2] || state[3] !== plan.close.sha3) throw new Error('CLOSE_STATE_FAILED');
const evidence = {
  command: 'pnpm evidence --m12-close',
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: m2Root, encoding: 'utf8' }).trim(),
  at: new Date().toISOString(),
  status: 'PASSED',
  demo: true,
  label: 'M12 hedged acceptance test (demo); fresh empty book, no holdings claim',
  network: 'qorechain-diana',
  chainId: 9800,
  contract: deployment.books.address,
  owner: context.account.evm,
  publicKey: toHex(registry.pqPublicKey),
  salt: plan.salt,
  book: plan.book,
  period: plan.period,
  openingSha3: plan.opening.sha3,
  closeSha3: plan.close.sha3,
  digest,
  signature: plan.signature,
  secondSignature: plan.secondSignature,
  hedged: true,
  context: '',
  signatureBytes: hexToBytes(plan.signature).length,
  precompile: {
    block: block.toString(),
    address: '0x0000000000000000000000000000000000000a01',
    differentSignatures: true,
    bothHedgedAccepted: accepted[0] === true && accepted[1] === true,
    deterministicAccepted: accepted[2],
    flippedRejected,
    booksEthCallAccepted: true,
  },
  legacy,
  window,
  openingPost,
  register,
  closePost,
  close,
  receipt: {
    transactionHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber.toString(),
    blockHash: receipt.blockHash,
    status: receipt.status,
    gasUsed: receipt.gasUsed.toString(),
    effectiveGasPrice: receipt.effectiveGasPrice.toString(),
  },
  closed: state[2],
};
assertPublic(evidence, [
  context.account.mnemonic ?? '',
  context.account.privateKey,
  context.account.privateKey.slice(2),
  toHex(context.account.pqc.secretKey).slice(2),
  Buffer.from(context.account.pqc.secretKey).toString('base64'),
]);
writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
console.log(
  `M12 hedged close accepted: ${close.hash} at ${close.blockNumber}; pinned precompile and Books eth_call passed.`,
);
