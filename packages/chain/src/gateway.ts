import { keccak256, type Abi, type Address, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { weiToUqorCeil } from '@qorechain/evm';
import type { UnifiedAccount } from '@qorechain/sdk';
import { hexSchema, type ChainConfig } from './config.js';
import type { Gateway } from './executor.js';
import { checkWindow } from './window.js';
import { syncPoolTree } from './tree.js';
import { gasLimitForEstimate } from './gas.js';
const MAX_FEE = 250000000000n;
export function createGateway(config: ChainConfig, account: UnifiedAccount, reader: PublicClient, abi: Abi, destination: Address = config.pool): Gateway {
    const signer = privateKeyToAccount(hexSchema.parse(account.privateKey));
    return {
        windowOpen: async () => (await checkWindow(config, account.cosmos)).kind === 'OPEN',
        async sign(prepared) {
            const value = BigInt(prepared.valueWei);
            if (await reader.getChainId() !== config.chainId)
                throw new Error('CHAIN_MISMATCH');
            const block = await reader.getBlockNumber({ cacheTime: 0 });
            const estimatedGas = await reader.estimateGas({ account: signer.address, to: destination, data: prepared.data, value,
                blockNumber: block, maxFeePerGas: MAX_FEE, maxPriorityFeePerGas: 1000000000n });
            const gasLimit = gasLimitForEstimate(estimatedGas);
            const window = await checkWindow(config, account.cosmos);
            if (window.kind !== 'OPEN' || window.window.nativeOnly ||
                window.window.remainingValue < weiToUqorCeil(value + gasLimit * MAX_FEE) ||
                (window.window.allowedTargets.length > 0 && !window.window.allowedTargets.some(target => target.toLowerCase() === destination.toLowerCase()))) {
                throw new Error('WINDOW_CLOSED');
            }
            const nonce = await reader.getTransactionCount({ address: signer.address, blockTag: 'pending' });
            const serialized = await signer.signTransaction({ chainId: config.chainId, to: destination, data: prepared.data, value,
                nonce, gas: gasLimit, maxFeePerGas: MAX_FEE, maxPriorityFeePerGas: 1000000000n, type: 'eip1559' });
            return { serialized, hash: keccak256(serialized), gas: { estimatedGas: estimatedGas.toString(),
                    gasLimit: gasLimit.toString(), maxFeePerGas: MAX_FEE.toString(), estimationBlock: block.toString() } };
        },
        broadcast: serialized => reader.sendRawTransaction({ serializedTransaction: serialized }),
        async receipt(hash) {
            const receipt = await reader.waitForTransactionReceipt({ hash, timeout: 120000 });
            return { hash: receipt.transactionHash, blockNumber: receipt.blockNumber.toString(), blockHash: receipt.blockHash,
                gasUsed: receipt.gasUsed.toString(), effectiveGasPrice: receipt.effectiveGasPrice.toString(), status: receipt.status };
        },
        async included(commitments, block) {
            const { tree } = await syncPoolTree(reader, config, abi, block);
            return commitments.every(commitment => tree.indexByCommitment.has(commitment.toLowerCase()));
        },
    };
}
