import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { deriveUnifiedAccount } from "@qorechain/sdk";

const FUSD_TESTNET = "0x97143B771D34ddb9130b807b135Ae675A5a963CA";
const accounts = new URL("../../.accounts/deployer.json", import.meta.url);
if (!existsSync(accounts)) throw new Error("run pnpm -C scripts accounts first");
const { mnemonic } = JSON.parse(readFileSync(accounts, "utf8"));
const deployer = await deriveUnifiedAccount(mnemonic, 0);

const windowEnv = new URL("../../tools/evm-window/.env", import.meta.url);
writeFileSync(windowEnv, [`QORE_MNEMONIC=${mnemonic}`, "QORE_NETWORK=testnet", "QORE_WINDOW_BLOCKS=600", "QORE_WINDOW_TXS=16", ""].join("\n"), { mode: 0o600 });

const contractsEnv = new URL("../../contracts/.env", import.meta.url);
const poseidon = process.env.POSEIDON2 ?? "";
writeFileSync(contractsEnv, [
  `PRIVATE_KEY=${deployer.privateKey}`,
  `POSEIDON2=${poseidon}`,
  `FUSD=${FUSD_TESTNET}`,
  "FUSD_PER_DEPOSIT=500000000",
  "FUSD_TOTAL=25000000000",
  "NATIVE_PER_DEPOSIT=20000000000000000000",
  "NATIVE_TOTAL=1000000000000000000000",
  "",
].join("\n"), { mode: 0o600 });
console.log(`deployer ${deployer.cosmos} (${deployer.evm})`);
console.log("wrote tools/evm-window/.env and contracts/.env (both git-ignored)");
if (!poseidon) console.log("POSEIDON2 is empty: after deploy-poseidon, rerun with POSEIDON2=0x... pnpm -C scripts env");
