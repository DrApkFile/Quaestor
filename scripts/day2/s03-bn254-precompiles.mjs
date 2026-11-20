import { bn254Vectors } from "./bn254-vectors.mjs";
import { rpc, requireTestnet, NETWORK } from "./env.mjs";

await requireTestnet();
let failed = 0;
for (const v of bn254Vectors()) {
  let got;
  try {
    got = await rpc("eth_call", [{ to: v.to, data: v.data }, "latest"]);
  } catch (error) {
    got = `error: ${error.message}`;
  }
  const pass = typeof got === "string" && got.toLowerCase() === v.expect.toLowerCase();
  if (!pass) failed += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${v.name}${pass ? "" : `\n      expected ${v.expect}\n      got      ${got}`}`);
}
console.log(`${NETWORK.evmRpc} · ${new Date().toISOString()} · ${failed === 0 ? "all BN254 precompiles answer correctly" : `${failed} failed`}`);
process.exit(failed === 0 ? 0 : 1);
