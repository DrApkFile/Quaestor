import { readFileSync, writeFileSync } from 'node:fs';
import { StargateClient } from '@cosmjs/stargate';
import { createPublicClient, http } from 'viem';
import { z } from 'zod';
import { parseConfig } from '../packages/chain/src/config.js';
const root = new URL('../', import.meta.url);
const config = parseConfig(JSON.parse(readFileSync(new URL('config/diana.json', root), 'utf8')) as unknown);
const features = [
  [
    'KEM registry',
    '8A8AFDBFD76F673141B8DEB7FDE937CE1B007A42E9F6A470BCEC137510B3AA85',
    'packages/chain/src/tickets/kemRegistry.ts',
  ],
  [
    'ML-DSA registry with possession proof',
    'A1D0F3DED37ED9D25B40D4483CBB5A0020AF4FE6B1E699B725522492C9E51230',
    'packages/chain/src/native.ts',
  ],
  [
    'Hybrid native transactions / SDK / EVM windows',
    '3A8964FF902A8F5F586868C9FC05FE850EA755658146CD926071CC6E8A1B8B99',
    'packages/chain/src/window.ts',
  ],
  [
    'pqcKeyStatus and pqcVerify / QoreSign close',
    '0x572e58fb84757b0207ab9f4de71a57a80a221ece7cd0cbfc2f84a8b05a2f814f',
    'contracts/src/Books.sol',
  ],
  [
    'QoreSeal anonymous ticket',
    '0x4438d004b7adf24786fb7ddc0b61822a85219966745a896044d3f2cfffba5efd',
    'packages/chain/src/tickets/ticket.ts',
  ],
  [
    'create-qorechain-dapp Foundry window helper / deployer registration',
    '98235E8AB0B6D450939EC05A60CDCA1A1FB6B7CB386C1D25A9254890B813DD52',
    'tools/evm-window/scripts/window.ts',
  ],
] as const;
const client = await StargateClient.connect(config.consensusRpc);
const evm = createPublicClient({ transport: http(config.evmRpc) });
const results = [];
try {
  for (const [feature, hash, source] of features) {
    readFileSync(new URL(source, root));
    if (hash.startsWith('0x')) {
      const receipt = await evm.getTransactionReceipt({
        hash: z
          .string()
          .regex(/^0x[\da-f]{64}$/)
          .transform((value) => value as `0x${string}`)
          .parse(hash),
      });
      if (receipt.status !== 'success') throw new Error('FEATURE_TX_REVERTED');
      results.push({ feature, hash, block: receipt.blockNumber.toString(), status: receipt.status, source });
    } else {
      const receipt = await client.getTx(hash);
      if (!receipt || receipt.code !== 0) throw new Error('FEATURE_TX_NOT_CONFIRMED');
      results.push({ feature, hash, block: String(receipt.height), code: receipt.code, source });
    }
  }
} finally {
  client.disconnect();
}
const evidence = {
  command: 'pnpm evidence --m8-kits',
  at: new Date().toISOString(),
  status: 'PASSED',
  network: 'qorechain-diana',
  results,
  scope:
    'Re-read successful historical receipts. Precompile read/bit-flip results are in m3-precompiles.json; template provenance is tools/evm-window/package.json and the builder day-1 log. Off-chain libraries and the scaffolder have no independent on-chain identity; listed transactions are application uses, not a claim that chain receipts name a JavaScript library.',
};
writeFileSync(new URL('evidence/m8-kits.json', root), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
