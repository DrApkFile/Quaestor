import { mkdirSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { generateMnemonic, deriveUnifiedAccount } from "@qorechain/sdk";

const ROLES = ["deployer", "business", "client", "supplier1", "supplier2", "auditor"];
const dir = new URL("../../.accounts/", import.meta.url);
mkdirSync(dir, { recursive: true });

const rows = [];
for (const role of ROLES) {
  const file = new URL(`${role}.json`, dir);
  if (existsSync(file)) {
    rows.push({ role, status: "kept (already exists)" });
    continue;
  }
  const mnemonic = generateMnemonic();
  const account = await deriveUnifiedAccount(mnemonic, 0);
  writeFileSync(file, JSON.stringify({ role, network: "qorechain-diana (testnet only)", mnemonic, cosmos: account.cosmos, evm: account.evm }, null, 2));
  chmodSync(file, 0o600);
  rows.push({ role, status: "created", qor1: account.cosmos, evm: account.evm });
}
console.table(rows);
console.log("Mnemonics are in .accounts/ (git-ignored). Testnet only: never send real funds to these accounts.");
console.log("Fund ONLY the deployer at https://dashboard.qorechain.io/faucet, then `pnpm -C tools/evm-window fund` sends QOR to the others.");
