# REALITY_SPIKES — Quaestor

The research sandbox cannot reach api-testnet.qore.host (proxy refused, 20 Nov). Run S03+ on your machine on **day 2**. Paste real output into `spikes/sNN-output.txt`. Do not build on a row that isn't `confirmed`.

| # | Claim | Source | Spike | Result | Date | Decision |
|---|---|---|---|---|---|---|
| S01 | Third party with only public ML-KEM keys can test who an envelope is sealed to; wrong key is refused | qoreseal spec §5.6 | `node spikes/s01-qoreseal-hint-audit.mjs <deps>` | **confirmed** offline (s01-output.txt) | 2026-11-20 | used for "sealed to the right auditor" checks |
| S02b | BN254 test vectors (ecAdd, ecMul, pairing true/false) are correct | — | `scripts/day2/bn254-vectors.mjs` run through @ethereumjs/evm 3.1.1 | **confirmed** offline: 4/4 PASS | 2026-11-20 | S03 uses them against Diana |
| S02c | circomlibjs 0.1.7 PoseidonT3 bytecode deploys and `poseidon([1,2])` matches circomlibjs's own hash | Gloam deploy-poseidon.mjs | local @ethereumjs/evm | **confirmed** offline: MATCH | 2026-11-20 | deploy-poseidon.mjs re-checks on Diana |
| S02d | Our `DeployQuaestorPool.s.sol` compiles with Gloam's vendored contracts; pool 11,949 B (< 24 KB) | — | solc-js 0.8.24, shanghai, 200 runs | **confirmed** offline: 0 errors | 2026-11-20 | |
| S02 | `@gloamtrade/sdk@0.8.0` builds a real shield proof for chain id 9800 with an explicit pool address, using the final zkeys, offline | builders.ts `resolveChainId` | `node spikes/s02-gloam-sdk-chain-9800.mjs <deps> <artifacts>` (needs `snarkjs` installed) | **confirmed** offline: `shieldBound` intent for chain 9800, 256-byte proof, verifies against `shield_vkey.json`, ~1.1 s (s02-output.txt). **Gotcha:** in Node, snarkjs worker threads hung (0% CPU for 10 min); pass `{ singleThread: true }` to `fullProve`/`verify` | 2026-11-20 | build the pool wrapper on SDK builders with explicit chainId + poolAddress |
| S03 | Diana's EVM has BN254 precompiles 0x06/0x07/0x08 | EVM_PRECOMPILES.md; organisers (Q6) | `pnpm -C scripts s03` | **confirmed live**: 4/4 PASS against https://evm-testnet.qore.host (spikes/s03-output.txt) | 2026-11-20 09:53 UTC | build on it |
| S04 | Our pool + verifiers + PoseidonT3 deploy on Diana under QoreChain rules | evm-differences.md; Gloam deploy notes | window open → `pnpm -C scripts poseidon` → `forge script …DeployQuaestorPool` | **confirmed live**: PoseidonT3 + 14 txs all succeeded, pool `0x27dD6Fd63B1CFdce96F6202B259E45A9587C8C55` (evidence/m0-deploy.json) | 2026-11-20 | build M1 on these addresses |
| S05 | `shieldBound` → `transfer` → `unshield` round trip works on Diana with fUSD | — | scripted, one account | — | | |
| S06 | Diana EVM gas for a Groth16 verify (pairing) fits the window spend limits; fees affordable on faucet QOR | — | read `gasUsed` from S05 receipts | — | | size windows |
| S07 | Diana EVM RPC serves `eth_getLogs` over the pool's range (tree sync) | Gloam sync.ts needs full log history | `syncTree` against our pool after S05 | — | | if capped: page by range, or index into our store with block proofs |
| S08 | REST `/qorechain/pqc/v1/kem/{addr}` and `/account/{addr}` reachable from the browser (CORS) | Quantum Dice README warns of CORS | fetch from a Vite page | — | | read-only proxy if blocked |
| S09 | pqcKeyStatus (0x0A02) and pqcVerify (0x0A01) active on Diana | FAQ (yes) vs EVM_PRECOMPILES.md 25 Oct (not yet) — **conflict** | `GET /cosmos/evm/vm/v1/params`; `cast call` 0x0A02 for a registered account | — | | if inactive: Books contract records signatures, verification moves to the verdict engine (stated) |
| S10 | MsgRegisterKEMKey + recipient card work for an in-app account; QoreX can't sign cards (`signArbitrary` refused) | qoreseal quickstart; qorex-integrations providers.ts | run qoreseal `examples/register-and-encrypt`; call `signArbitrary` | — | | users get an in-app account (D1) |
| S11 | A QoreSeal ticket (2–3 recipients) fits GloamPayMemo `MAX_MEMO` 8192 B and costs acceptable gas | GloamPayMemo.sol; QoreSeal size formula | post one memo on Diana | — | | |
| S12 | Faucet: 100 QOR + 1,000 fUSD per claim, one claim per 24 h per account **and per address** | docs.qorechain.io/dashboard/faucet (fetched 20 Nov) | fund the deployer, then `pnpm -C tools/evm-window fund` sends QOR to the others | — | | |
| S13 | The faucet pays fUSD as a **bank coin** (`erc20:0x9714…63CA`); the ERC-20 form at `0x97143B771D34ddb9130b807b135Ae675A5a963CA` (6 decimals) needs `MsgConvertCoin` | docs.qorechain.io/dashboard/faucet | convert 100 fUSD for the business account, read `balanceOf` | — | | until confirmed, M1 shields native QOR first (pool has a native limit too) |
| S14 | A 16-tx window sized at 3M gas × 250 gwei per tx covers the M0 deploy | template window.ts sizing | `pnpm window status` before and after | **confirmed live**: 15 of 16 txs used (Poseidon + 14), 12 QOR budget; actual gas price ~100 gwei | 2026-11-20 | keep 16-tx windows for batches |

## Conflicts on record
- Precompile activation (S09): docs dated 25 Oct vs FAQ 20 Nov.
- Gloam's deploy scripts hard-code Gloam's chains, deployer and fee recipient: we write our own deploy script (credited) rather than editing theirs.
