import { readFileSync } from "node:fs";
import { StargateClient } from "@cosmjs/stargate";
import { EthNativeSigner, deriveUnifiedAccount, getNetwork } from "@qorechain/sdk";

const ROLES = ["business", "client", "supplier1", "supplier2", "auditor"] as const;
const UQOR_EACH = BigInt(process.env.QUAESTOR_FUND_UQOR ?? "10000000");
const FEE = { amount: [{ denom: "uqor", amount: "100000" }], gas: "800000" };

function mnemonicOf(role: string): string {
  const file = new URL(`../../../.accounts/${role}.json`, import.meta.url);
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (typeof parsed !== "object" || parsed === null || typeof (parsed as { mnemonic?: unknown }).mnemonic !== "string") {
    throw new Error(`.accounts/${role}.json has no mnemonic`);
  }
  return (parsed as { mnemonic: string }).mnemonic;
}

async function accountSequence(rest: string, address: string): Promise<{ accountNumber: bigint; sequence: bigint }> {
  const res = await fetch(`${rest}/cosmos/auth/v1beta1/accounts/${address}`);
  if (res.status === 404) throw new Error(`${address} does not exist on chain yet: fund it from the faucet first`);
  if (!res.ok) throw new Error(`account query failed: HTTP ${res.status}`);
  const body = (await res.json()) as { account?: Record<string, unknown> };
  const acc = (body.account?.base_account ?? body.account ?? {}) as Record<string, string>;
  return { accountNumber: BigInt(acc.account_number ?? "0"), sequence: BigInt(acc.sequence ?? "0") };
}

const net = getNetwork("testnet");
const rest = process.env.QORE_REST_URL?.trim() || net.endpoints.rest;
const rpc = process.env.QORE_RPC_URL?.trim() || net.endpoints.rpc;
const deployer = await deriveUnifiedAccount(mnemonicOf("deployer"), 0);
const signer = new EthNativeSigner(deployer, { signMode: "hybrid", rest });
const transport = await StargateClient.connect(rpc);
try {
  for (const role of ROLES) {
    const to = await deriveUnifiedAccount(mnemonicOf(role), 0);
    const { accountNumber, sequence } = await accountSequence(rest, deployer.cosmos);
    const res = await signer.signAndBroadcast(transport, {
      chainId: net.chainId,
      accountNumber,
      sequence,
      fee: FEE,
      messages: [{ typeUrl: "/cosmos.bank.v1beta1.MsgSend", value: { fromAddress: deployer.cosmos, toAddress: to.cosmos, amount: [{ denom: "uqor", amount: UQOR_EACH.toString() }] } }],
    });
    console.log(`${role.padEnd(10)} ${to.cosmos}  ${UQOR_EACH} uqor  tx ${res.transactionHash}`);
  }
} finally {
  transport.disconnect();
}
