import { accountSequence } from './sequence.js';
import { StargateClient } from "@cosmjs/stargate";
import { EthNativeSigner, getNetwork, buildRegisterPqcKeyMsg, deriveUnifiedAccount, fetchPqcStatus, generatePqcRecoveryCode, isRegisteredPqcKey, isValidRecoveryCode, openEvmWindowMsg, signProofOfPossession, unifiedAccountFromSeed, type UnifiedAccount, } from "@qorechain/sdk";
import { evmWindowCost, evmWindowStatus } from "@qorechain/evm";
const preset = (name: "testnet" | "mainnet") => {
    const n = getNetwork(name);
    return {
        chainId: n.chainId,
        rest: process.env.QORE_REST_URL?.trim() || n.endpoints.rest,
        rpc: process.env.QORE_RPC_URL?.trim() || n.endpoints.rpc,
    };
};
const NETWORKS = {
    testnet: preset("testnet"),
    mainnet: preset("mainnet"),
} as const;
function network(): (typeof NETWORKS)[keyof typeof NETWORKS] {
    const name = process.env.QORE_NETWORK ?? 'testnet';
    if (name !== 'testnet' && name !== 'mainnet')
        throw new Error('NETWORK_INVALID');
    return NETWORKS[name];
}
function account(): Promise<UnifiedAccount> {
    return Promise.resolve().then(() => {
        const mnemonic = process.env.QORE_MNEMONIC?.trim();
        if (mnemonic)
            return deriveUnifiedAccount(mnemonic, 0);
        const key = process.env.PRIVATE_KEY?.trim();
        if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
            throw new Error("Set QORE_MNEMONIC, or PRIVATE_KEY as 0x followed by 64 hex characters, in .env");
        }
        const recoveryCode = process.env.QORE_PQC_RECOVERY_CODE?.trim();
        if (!recoveryCode) {
            throw new Error("Set QORE_PQC_RECOVERY_CODE in .env: with PRIVATE_KEY the account's ML-DSA-87 key comes from a separate " +
                "recovery code. Create one with `pnpm window recovery-code` (generatePqcRecoveryCode from @qorechain/sdk) " +
                "and store it apart from the private key, or set QORE_MNEMONIC instead.");
        }
        if (!isValidRecoveryCode(recoveryCode)) {
            throw new Error("QORE_PQC_RECOVERY_CODE is not a valid QRC1 recovery code (check for a typo)");
        }
        return unifiedAccountFromSeed(Uint8Array.from(Buffer.from(key.slice(2), "hex")), { recoveryCode });
    });
}
const FEE = { amount: [{ denom: "uqor", amount: "100000" }], gas: "800000" };
async function status(): Promise<void> {
    const net = network();
    const acc = await account();
    console.log(`account:  ${acc.evm}  (${acc.cosmos})`);
    const pqc = await fetchPqcStatus({ rest: net.rest, address: acc.cosmos });
    const mine = pqc.registered ? isRegisteredPqcKey(pqc, acc.pqc.publicKey) : false;
    console.log(`PQC key:  ${pqc.registered ? (mine === false ? "registered, but NOT this key" : "registered") : "not registered (run: pnpm window register)"}`);
    const w = await evmWindowStatus({ rest: net.rest, address: acc.cosmos });
    if (!w.found) {
        console.log("window:   none (run: pnpm window open)");
    }
    else {
        console.log(`window:   ${w.live ? "live" : "not usable"}; ${String(w.remainingBlocks)} blocks, ${String(w.remainingTxs)} txs, ${String(w.remainingValue)} uqor left`);
    }
}
async function broadcast(acc: UnifiedAccount, mode: "hybrid" | "classical", messages: Parameters<EthNativeSigner["sign"]>[0]["messages"]): Promise<string> {
    const net = network();
    const { accountNumber, sequence } = await accountSequence(net.rest, acc.cosmos);
    const signer = new EthNativeSigner(acc, { signMode: mode, rest: net.rest });
    const transport = await StargateClient.connect(net.rpc);
    try {
        const res = await signer.signAndBroadcast(transport, {
            chainId: net.chainId,
            accountNumber,
            sequence,
            fee: FEE,
            messages,
        });
        return res.transactionHash;
    }
    finally {
        transport.disconnect();
    }
}
async function register(): Promise<void> {
    const net = network();
    const acc = await account();
    const pqc = await fetchPqcStatus({ rest: net.rest, address: acc.cosmos });
    if (pqc.registered) {
        console.log("The account already has a PQC key; nothing to do.");
        return;
    }
    const proofOfPossession = signProofOfPossession({ chainId: net.chainId, account: acc.cosmos, keypair: acc.pqc });
    const msg = buildRegisterPqcKeyMsg(acc.cosmos, { pqcKeypair: acc.pqc, proofOfPossession });
    console.log(`registered: ${await broadcast(acc, "classical", [msg])}`);
}
async function open(): Promise<void> {
    const acc = await account();
    const blocks = BigInt(process.env.QORE_WINDOW_BLOCKS ?? "600");
    const maxTxs = BigInt(process.env.QORE_WINDOW_TXS ?? "5");
    const perTx = evmWindowCost({ gas: 3000000n, maxFeePerGas: 250000000000n });
    const maxValue = BigInt(process.env.QORE_WINDOW_MAX_UQOR ?? (perTx * maxTxs).toString());
    const msg = openEvmWindowMsg({ sender: acc.cosmos, blocks, maxTxs, maxValue });
    console.log(`opened: ${await broadcast(acc, "hybrid", [msg])}`);
    console.log(`window: ${String(blocks)} blocks, ${String(maxTxs)} txs, ${String(maxValue)} uqor (value plus fees)`);
    console.log("Opening advanced the account's nonce; deploy now.");
}
function recoveryCode(): Promise<void> {
    return Promise.resolve().then(() => {
        console.log(generatePqcRecoveryCode());
        console.log("Put it in .env as QORE_PQC_RECOVERY_CODE and keep a copy apart from PRIVATE_KEY.");
        console.log("Use the same code every time: a new code gives the account a different ML-DSA-87 key.");
    });
}
const commands: Partial<Record<string, () => Promise<void>>> = { status, register, open, "recovery-code": recoveryCode };
const cmd = process.argv[2] ?? "status";
const run = commands[cmd];
if (!run) {
    console.error(`Unknown command "${cmd}". Use: status | register | open | recovery-code`);
    process.exit(1);
}
run().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
});
