import { readFileSync, existsSync } from "node:fs";
import { deriveUnifiedAccount } from "@qorechain/sdk";

export const NETWORK = Object.freeze({
  rest: process.env.QORE_REST_URL ?? "https://api-testnet.qore.host",
  evmRpc: process.env.QORE_EVM_RPC_URL ?? "https://evm-testnet.qore.host",
  evmChainId: 9800,
});

export function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`set ${name} (see scripts/day2/README.md)`);
  return value;
}

export async function loadAccount(role) {
  const file = new URL(`../../.accounts/${role}.json`, import.meta.url);
  if (!existsSync(file)) throw new Error(`no .accounts/${role}.json: run pnpm -C scripts accounts first`);
  const { mnemonic } = JSON.parse(readFileSync(file, "utf8"));
  return deriveUnifiedAccount(mnemonic, 0);
}

export async function rpc(method, params) {
  const res = await fetch(NETWORK.evmRpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}

export async function requireTestnet() {
  const id = Number.parseInt(await rpc("eth_chainId", []), 16);
  if (id !== NETWORK.evmChainId) throw new Error(`EVM RPC answers chain ${id}, expected ${NETWORK.evmChainId}`);
}
