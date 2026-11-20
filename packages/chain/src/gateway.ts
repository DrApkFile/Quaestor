import { createWalletClient, http, keccak256, type Abi, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { weiToUqorCeil } from '@qorechain/evm';
import type { UnifiedAccount } from '@qorechain/sdk';
import { hexSchema, type ChainConfig } from './config.js';
import type { Gateway } from './executor.js';
import { checkWindow } from './window.js';
import { syncPoolTree } from './tree.js';
import { dianaChain } from './network.js';

const GAS_LIMIT = 3_000_000n;
const MAX_FEE = 250_000_000_000n;
export function createGateway(config: ChainConfig, account: UnifiedAccount, reader: PublicClient, abi: Abi): Gateway {
  const signer = privateKeyToAccount(hexSchema.parse(account.privateKey));
  const wallet = createWalletClient({ account: signer, chain: dianaChain, transport: http(config.evmRpc, { retryCount: 0 }) });
  return {
    windowOpen: async () => (await checkWindow(config, account.cosmos)).kind === 'OPEN',
    async sign(prepared) {
      const window = await checkWindow(config, account.cosmos);
      const value = BigInt(prepared.valueWei);
      if (window.kind !== 'OPEN' || window.window.nativeOnly ||
        window.window.remainingValue < weiToUqorCeil(value + GAS_LIMIT * MAX_FEE) ||
        (window.window.allowedTargets.length > 0 && !window.window.allowedTargets.some(target => target.toLowerCase() === config.pool.toLowerCase()))) {
        throw new Error('WINDOW_CLOSED');
      }
      if (await reader.getChainId() !== config.chainId) throw new Error('CHAIN_MISMATCH');
      const nonce = await reader.getTransactionCount({ address: signer.address, blockTag: 'pending' });
      const serialized = await wallet.signTransaction({ chain: dianaChain, to: config.pool, data: prepared.data, value,
        nonce, gas: GAS_LIMIT, maxFeePerGas: MAX_FEE, maxPriorityFeePerGas: 1_000_000_000n, type: 'eip1559' });
      return { serialized, hash: keccak256(serialized) };
    },
    broadcast: serialized => reader.sendRawTransaction({ serializedTransaction: serialized }),
    async receipt(hash) {
      const receipt = await reader.waitForTransactionReceipt({ hash, timeout: 120_000 });
      return { hash: receipt.transactionHash, blockNumber: receipt.blockNumber.toString(), blockHash: receipt.blockHash,
        gasUsed: receipt.gasUsed.toString(), effectiveGasPrice: receipt.effectiveGasPrice.toString(), status: receipt.status };
    },
    async included(commitments, block) {
      const { tree } = await syncPoolTree(reader, config, abi, block);
      return commitments.every(commitment => tree.indexByCommitment.has(commitment.toLowerCase()));
    },
  };
}
