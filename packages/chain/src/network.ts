import { defineChain, type Chain } from 'viem';
import { qorechainTestnet } from '@qorechain/evm';
export const dianaChain: Chain = defineChain({
    id: qorechainTestnet.id,
    name: qorechainTestnet.name,
    nativeCurrency: qorechainTestnet.nativeCurrency,
    rpcUrls: qorechainTestnet.rpcUrls,
});
