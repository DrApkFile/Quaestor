import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { z } from 'zod';
import { decodeFunctionData, parseAbi } from 'viem';
const hash = '0xcbc5dc60c0c858acde34d541e3d9f91d6388ddb8ae5df9cbef0673166d6391bd';
const hex = z.string().regex(/^0x[0-9a-fA-F]+$/);
const rpc = async (method: string, params: unknown[]): Promise<unknown> => {
  const response = await fetch('https://evm-testnet.qore.host', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(30000),
  });
  return z.object({ result: z.unknown() }).parse((await response.json()) as unknown).result;
};
const receipt = z
  .object({ transactionHash: hex, blockNumber: hex, blockHash: hex, status: hex, gasUsed: hex, to: hex })
  .parse(await rpc('eth_getTransactionReceipt', [hash]));
const tx = z
  .object({ hash: hex, blockHash: hex, input: hex, to: hex })
  .parse(await rpc('eth_getTransactionByHash', [hash]));
if (
  receipt.status !== '0x1' ||
  receipt.transactionHash !== hash ||
  tx.hash !== hash ||
  receipt.blockHash !== tx.blockHash ||
  receipt.to.toLowerCase() !== '0x9775c1d0dc814e41fb1b38d26fa17f60d24faf64' ||
  receipt.to !== tx.to
)
  throw new Error('RECEIPT_MISMATCH');
const decoded = decodeFunctionData({
  abi: parseAbi([
    'function closePeriod(bytes32 book, bytes32 period, uint64 entryCount, bytes32 lastEntrySha3, bytes32 closeSha3, bytes mlDsaSignature)',
  ]),
  data: tx.input as `0x${string}`,
});
const signatureBytes = (decoded.args[5].length - 2) / 2;
if (signatureBytes !== 4627) throw new Error('SIGNATURE_LENGTH');
const calldataBytes = (tx.input.length - 2) / 2;
const result = {
  command: 'pnpm evidence --m11-pq-gas',
  at: new Date().toISOString(),
  commit: spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(),
  sourceEvidence: 'evidence/m4-verdicts.json:transactions.closeTx',
  chainId: await rpc('eth_chainId', []),
  receipt: {
    ...receipt,
    gasUsed: BigInt(receipt.gasUsed).toString(),
    blockNumber: BigInt(receipt.blockNumber).toString(),
  },
  calldataBytes,
  signatureBytes,
  signaturePaddedBytes: Math.ceil(signatureBytes / 32) * 32,
  abiOverheadBytes: calldataBytes - Math.ceil(signatureBytes / 32) * 32,
  pqcVerifyGas: null,
  isolation:
    'Not isolated. This is total closePeriod receipt gas, including calldata, key status, storage, event and verification; no Ethereum comparison measured.',
};
writeFileSync(new URL('../evidence/m11-pq-gas.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(
  `M11 close ${hash}: gas=${result.receipt.gasUsed}, calldata=${String(calldataBytes)} bytes, ML-DSA-87 signature=${String(signatureBytes)} bytes; verifier cost not isolated.`,
);
