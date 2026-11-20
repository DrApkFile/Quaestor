import { IQORE_PQC_ABI } from '@qorechain/evm';
import { pqcSign } from '@qorechain/sdk';
import { toHex, toBytes, keccak256 } from 'viem';
import { z } from 'zod';
import { m2Context, m2Root } from './m2Context.js';
import { sha3 } from './m2Evidence.js';
import { writePrivateJson } from '../src/storage.js';
import { execFileSync } from 'node:child_process';

const context = await m2Context('business', 'm3');
const block = await context.reader.getBlockNumber({ cacheTime: 0 });
const statusAbi = [{ type: 'function', name: 'pqcKeyStatus', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }],
 outputs: [{ type: 'bool' }, { type: 'uint8' }, { type: 'bytes' }, { type: 'bool' }] }] as const;
const raw: unknown = await context.reader.readContract({ address: '0x0000000000000000000000000000000000000a02', abi: statusAbi,
 functionName: 'pqcKeyStatus', args: [context.account.evm as `0x${string}`], blockNumber: block });
const status = z.tuple([z.boolean(), z.number(), z.string().regex(/^0x[\da-f]+$/i), z.boolean()]).parse(raw);
const message = toBytes(keccak256(toBytes('quaestor:s16:raw-32-byte-message')));
const signature = pqcSign(context.account.pqc.secretKey, message);
const bad = Uint8Array.from(signature); bad[0] = (bad[0] ?? 0) ^ 1;
const verify = (sig: Uint8Array) => context.reader.readContract({ address: '0x0000000000000000000000000000000000000a01', abi: IQORE_PQC_ABI,
 functionName: 'pqcVerify', args: [toHex(context.account.pqc.publicKey), toHex(sig), toHex(message)], blockNumber: block });
const accepted: unknown = await verify(signature);
const flipped: unknown = await verify(bad);
const result = { command: 'pnpm evidence --m3-spikes', commit: execFileSync('git', ['rev-parse','HEAD'], {cwd:m2Root,encoding:'utf8'}).trim(),
 at: new Date().toISOString(), block: block.toString(), business: context.account.evm, registered: status[0], algorithm: status[1], possessionProven: status[3],
 publicKeyMatches: status[2].toLowerCase() === toHex(context.account.pqc.publicKey).toLowerCase(), publicKeySha3: sha3(context.account.pqc.publicKey),
 messageBytes: message.length, signatureBytes: signature.length, accepted, flippedRejected: flipped === false, context: '', prehash: false,
 source: 'https://github.com/qorechain/qorechain-core/blob/main/docs/EVM_PRECOMPILES.md#pqcverify-0x0a01' };
writePrivateJson(`${m2Root}/evidence/m3-precompiles.json`, result);
console.log(JSON.stringify(result,null,2));
if (!status[0] || status[1]!==1 || !status[3] || accepted!==true || flipped!==false) throw new Error('PQC_SPIKE_FAILED');
