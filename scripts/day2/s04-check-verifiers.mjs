import { readFileSync } from "node:fs";
import { createPublicClient, http, parseAbi } from "viem";
import { qorechainTestnet } from "@qorechain/evm";
import * as snarkjs from "snarkjs";
import { buildShieldBoundIntent, packGroth16Proof } from "@gloamtrade/sdk";
import { NETWORK, requireEnv, requireTestnet } from "./env.mjs";

await requireTestnet();
const shieldVerifier = requireEnv("SHIELD_VERIFIER");
const pool = requireEnv("POOL");
const fusd = requireEnv("FUSD");
const circuits = new URL("../../apps/web/public/circuits/", import.meta.url);
const wasm = new URL("shield.wasm", circuits).pathname;
const zkey = new URL("shield_final.zkey", circuits).pathname;

let captured;
const prover = async (input) => {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasm, zkey, undefined, undefined, { singleThread: true });
  captured = { proof, publicSignals };
  return { proofBytes: packGroth16Proof(proof), publicSignals };
};
await buildShieldBoundIntent({ chainId: NETWORK.evmChainId, poolAddress: pool, amountWei: 1_000_000n, asset: fusd, prover });

const reader = createPublicClient({ chain: qorechainTestnet, transport: http(NETWORK.evmRpc) });
const abi = parseAbi(["function verify(bytes proof, uint256[] publicInputs) view returns (bool)"]);
const proof = packGroth16Proof(captured.proof);
const pub = captured.publicSignals.map((s) => BigInt(s));
const real = await reader.readContract({ address: shieldVerifier, abi, functionName: "verify", args: [proof, pub] });
const tampered = await reader.readContract({ address: shieldVerifier, abi, functionName: "verify", args: [proof, [pub[0], pub[1] + 1n, pub[2]]] });
const ok = real === true && tampered === false;
console.log(JSON.stringify({ shieldVerifier, realProofAccepted: real, tamperedAmountRejected: tampered === false, at: new Date().toISOString() }));
console.log(ok ? "PASS: QoreChain testnet verifies a real Groth16 proof on chain and rejects a tampered one" : "FAIL");
process.exit(ok ? 0 : 1);
