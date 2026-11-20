import { createWalletClient, createPublicClient, http, encodeFunctionData, decodeFunctionResult } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { qorechainTestnet, evmWindowStatus } from "@qorechain/evm";
import { poseidonContract, buildPoseidon } from "circomlibjs";
import { NETWORK, loadAccount, requireTestnet } from "./env.mjs";

await requireTestnet();
const deployer = await loadAccount("deployer");
const window = await evmWindowStatus({ rest: NETWORK.rest, address: deployer.cosmos });
if (!window.found || !window.live || window.remainingTxs < 1n) {
  throw new Error("deployer has no live EVM window: run `pnpm window open` in tools/evm-window first");
}
const account = privateKeyToAccount(deployer.privateKey);
const transport = http(NETWORK.evmRpc);
const wallet = createWalletClient({ account, chain: qorechainTestnet, transport });
const reader = createPublicClient({ chain: qorechainTestnet, transport });

const hash = await wallet.sendTransaction({ data: poseidonContract.createCode(2) });
console.log("tx", hash);
const receipt = await reader.waitForTransactionReceipt({ hash });
if (receipt.status !== "success" || !receipt.contractAddress) throw new Error(`deploy failed: ${receipt.status}`);
const address = receipt.contractAddress;

const abi = poseidonContract.generateABI(2).filter((f) => f.name === "poseidon" && f.inputs[0].type === "uint256[2]");
const data = encodeFunctionData({ abi, functionName: "poseidon", args: [[1n, 2n]] });
const onchain = decodeFunctionResult({ abi, functionName: "poseidon", data: await reader.call({ to: address, data }).then((r) => r.data) });
const poseidon = await buildPoseidon();
const expected = poseidon.F.toObject(poseidon([1n, 2n]));
if (onchain !== expected) throw new Error(`PoseidonT3 at ${address} answers ${onchain}, expected ${expected}`);
console.log(JSON.stringify({ poseidonT3: address, block: receipt.blockNumber.toString(), tx: hash, gasUsed: receipt.gasUsed.toString(), check: "poseidon([1,2]) matches circomlibjs" }));
console.log(`put POSEIDON2=${address} in contracts/.env`);
