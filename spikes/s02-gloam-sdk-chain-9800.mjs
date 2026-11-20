import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const req = createRequire(process.argv[2] + "/");
const sdk = await import(req.resolve("@gloamtrade/sdk"));
const snarkjs = await import(req.resolve("snarkjs"));
const art = process.argv[3];
let last;
const prover = async (input) => {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, `${art}/shield.wasm`, `${art}/shield_final.zkey`, undefined, undefined, { singleThread: true });
  last = { proof, publicSignals };
  return { proofBytes: sdk.packGroth16Proof(proof), publicSignals };
};
const t0 = Date.now();
try {
  const intent = await sdk.buildShieldBoundIntent({
    chainId: 9800, poolAddress: "0x000000000000000000000000000000000000dEaD",
    amountWei: 1000000n, asset: "0x1111111111111111111111111111111111111111", prover,
  });
  const vkey = JSON.parse(readFileSync(`${art}/shield_vkey.json`, "utf8"));
  const ok = await snarkjs.groth16.verify(vkey, last.publicSignals, last.proof, undefined, { singleThread: true });
  console.log(JSON.stringify({ chainId: intent.chainId, fn: intent.exec.fn, pool: intent.exec.poolAddress, proofBytes: (intent.exec.args[3].length - 2) / 2, offchainVerify: ok, ms: Date.now() - t0 }));
} catch (e) { console.log("refused:", e.message); }
process.exit(0);
