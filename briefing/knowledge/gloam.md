# Gloam (open-source shielded pool) — what Quaestor reuses

Researched: 2026-11-20
Primary sources: github.com/gloamtrade/gloam @ main (cloned 20 Nov, last commit 19 Nov): README.md, DEPLOY.md, contracts/{src,script,foundry.toml}, contracts/src/GloamPayMemo.sol, packages/sdk/src/{builders,constants,receiveTag,proofs,sync,prove}.ts, LICENSE. npm `@gloamtrade/sdk@0.8.0` (licence MIT).

**Positioning rule:** we are not Gloam and not affiliated. We use its MIT code and deploy **our own** instance on QoreChain testnet. We never use Gloam's hosted services (relay, API keys, hosted MCP, gloam.trade artifacts) and never describe Gloam's mainnet product. README credit line: "Private rail built on Gloam's open-source shielded pool and SDK (MIT), deployed by us on QoreChain testnet. Not affiliated with Gloam."

## What it actually is
A Zcash-lineage shielded pool on EVM: Poseidon note commitments `Poseidon(secret, amount, asset)` in a depth-20 incremental Merkle tree; Groth16 (BN254) proofs for shield (deposit), transfer (private send) and unshield (cash out); plus off-chain disclosure proofs (receipt, funds, payroll_total). Circom circuits, snarkjs proving in the browser.

## Pieces we deploy on QoreChain (Diana, EVM 9800)
| Contract | Notes |
|---|---|
| PoseidonT3 | deployed from raw bytecode by `circuits/scripts/deploy-poseidon.mjs` |
| Final verifiers (`src/verifiers/final/*`) | Shield, Transfer, Unshield (+ "I" variants). Use precompiles **0x06, 0x07, 0x08** (BN254 add, mul, pairing) |
| `ShieldPoolPayments` | ~11.9 KB code (under the 24 KB limit per their deploy notes). Deposits must be proof-bound (`shieldBound`) |
| `GloamPayMemo` | event-only board; `postMemo(paymentCommitment, memo)`; `MAX_MEMO = 8192` bytes; does not emit the poster |
Deploy scripts (`MainnetDeploy.sol`) hard-check chain ids, Gloam's deployer, fee recipient and ceremony keys. **Write our own deploy script** (credited, adapted) that sets: our owner, fee 0 bps or our own recipient, deposit limits for fUSD, and keeps the `_requireCeremonyKeys` check.

## Keys and artifacts
Final ceremony keys (13 contributors) are circuit-specific, not chain-specific, so the final zkeys verify on any chain. wasm + zkey + vkey for shield, transfer, unshield, receipt, funds, payroll_total are in `app/public/circuits/` (final zkeys ~46 MB total). **Self-host them** in our web app; never load from gloam.trade.

## SDK on a custom chain
- Builders (`buildShieldBoundIntent`, `buildPrivateSendIntent`, `buildUnshieldIntent`) take `chainId` and `poolAddress` overrides; with both given, no closed-network check is hit (read in builders.ts `resolveChainId`, constants.ts `poolForChainId`). Spike S02 runs a real shield proof for chain 9800.
- Some APIs take a closed `GloamNetworkKey` union (api.ts, commerce.ts) — we don't use those (they are the hosted API).
- `syncTree(client, { pool, fromBlock })` reads `Insert` logs with a viem client: needs Diana's EVM RPC to serve `eth_getLogs` over the pool's whole range (spike S07).
- `snarkjs` is an optional peer dependency: install it explicitly (pin it). In Node, pass `{ singleThread: true }` as snarkjs prover/verify options — the default worker threads hung in our sandbox (S02). Test the browser path separately.

## Proofs we use
- **receipt** (`buildReceiptWitness`): proves "I know the secret of leaf `commitment` under `root`, amount exact or ≥ min", bound to a public `context`. Either side of a payment can make it. It does **not** prove who paid or who was paid.
- **payroll_total**: proves up to 32 payments funded by the prover add to exactly a total (spend nullifiers public) — candidate for quarter outflow totals.
- **funds**: ≥ threshold across ≤ 4 unspent notes. Exact balance = receipt on one consolidated note.
- `proofContext(...)` hashes label/expiry/chain/pool into `context`; we bind ours to `quaestor|book|quarter|entryId`.

## The weakness we fix (receive tags)
`receiveTag.ts`: payment tickets (which carry the **note secret**) are sealed with **P-256 ECDH** + HKDF + AES-GCM and posted publicly on the memo board. Harvest now, decrypt later: whoever breaks P-256 later learns past payment details and can spend notes still unspent. Quaestor seals tickets with **QoreSeal hybrid (ML-KEM-1024 + X25519)** to the payee's on-chain registered key instead, and never falls back to P-256. ~3.4–5.1 KB per ticket for 2–3 recipients, under the 8,192-byte memo limit.

## Known limits (state them in the README)
- Groth16 on BN254 is **not** post-quantum: a quantum attacker could forge proofs (soundness), so the pool's solvency is not PQ. Poseidon commitments' hiding is not threatened the same way. Quaestor claims PQ **confidentiality of tickets and books**, not a PQ pool.
- Deposits are public (amount, asset, depositor). Cash-out recipient and amount are public.
- Gloam's own audit covered its vault contracts, not circuits/app/relay (their README). Our deployment and wrapper are unaudited.
