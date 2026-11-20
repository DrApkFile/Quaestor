# @quaestor/chain

M1 script support for our deployment of Gloam's open-source pool on QoreChain Diana (9800). The pool's Groth16 BN254 proofs are not post-quantum.

`config/diana.json` supplies every required endpoint, address and scan parameter. Startup validates it with Zod. `accounts.ts` derives script accounts from the git-ignored `.accounts/` files; it is not a browser account store.

Run from the repository root:

```sh
pnpm -C packages/chain typecheck
pnpm -C packages/chain test
pnpm evidence --m1
pnpm evidence --m1-gas
pnpm evidence --m1b-fusd
```

The evidence runner registers proven ML-DSA-87 keys, opens EVM windows before reading nonces, shields 5 native QOR, privately sends 2 QOR, and unshields to supplier1. It checks the supplier's balance delta against the receipt gas and the live cash-out fee. The original S13 attempt used a zero bank balance and was not a valid conversion test. The M1b runner funds business with 100 bank fUSD from deployer, converts 100, then approves and shields 50 fUSD. It refuses to overwrite existing M1b evidence; inspect a failed run and any held transaction before planning another run. No further fUSD paths are built.

The local `.accounts/m1/journal.json` stores note secrets with owner-only permissions. The shared script journal is the M1 local handover: payment outputs belong to the payee, change belongs to the sender. It is not a published ticket. Keep this directory backed up privately. Never copy it into evidence or logs.

Operations move through `PLANNED`, `PROVED`, `BROADCAST`, `LANDED`, with `OUTCOME_UNKNOWN` held. Outputs and encoded calls are durable before signing. The signed transaction hash is durable before broadcast. Gas is estimated at a pinned block, multiplied by 1.25 and rounded up, capped at 3,000,000; the window budget uses the signed limit. Estimates above the cap are refused. Signed gas metadata is retained in the journal and evidence. Repeating an operation in `BROADCAST` or `OUTCOME_UNKNOWN` refuses to rebuild or resend it; `resolveOperation` only reads its existing hash. The runner resolves those hashes on restart. Inputs remain `SPENDING` until a receipt; outputs remain `INCOMING` until receipt plus tree inclusion. Reverted receipts restore the input and discard pending outputs.

A process lock prevents two writers. A crash can leave `journal.json.lock`; verify that no process still owns the journal before removing that lock. Removing the lock does not clear held operations or notes. A proof failure leaves `PLANNED` safe to retry under the same operation ID. Do not start a second runner or use these accounts in another wallet during a run.

Tree replay uses the SDK's paged `createTreeSync` from deployment block 10427515. The deployed contracts name their insertion events `Shielded` and `Transferred`; these supply the ordered insertion history. The rebuilt root must equal `currentRoot` at the selected block. No stored seed, hosted leaf service or `isKnownRoot` fallback is used. Pool decision reads share that selected height.

Native broadcast failures preserve the chain code, codespace and rawLog, with keys redacted and rawLog truncated to 500 characters. The original unsafe error is not attached. Transport failures have null chain fields rather than invented rejection codes.

Proofs use only local wasm/zkey files under `apps/web/public/circuits/`, with snarkjs workers disabled. The offline proof test requires these artifacts. They are not committed.

Not built: browser persistence, PQ tickets, KEM registration, hosted services, fUSD payments, auditor root-history verdicts or UI. The fUSD spike's protobuf field layout follows the upstream [Cosmos EVM MsgConvertCoin definition](https://github.com/cosmos/evm/blob/main/proto/cosmos/evm/erc20/v1/tx.proto); the QoreChain SDK registry is extended only for that spike.
