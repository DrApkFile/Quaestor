# Handoff M1-fixes — Claude's required fixes before M2

Date (UTC): 2026-11-20
Agent: Codex
Commits: 07ef35eb6dd0233534fe753b35f88b8b75de5f5c..1b02e6021c6b7b8d04c668fc561316b3c79872c1 (fix commits; this handoff is committed afterward)

07ef35eb6dd0233534fe753b35f88b8b75de5f5c Size pool transaction gas from the estimate and persist signed limits
425edeae3eed337d99522df7fbdfe394d72e565c Record the estimated-limit one-QOR shield and its actual fee
2035d1ce27dcafe7f4e03b2229d4bc00c6be8089 Retain native rejection diagnostics and test conversion with funded bank fUSD
d1eee46c204c4fdae7b66fd52887995d111473ef Prove funded fUSD conversion and the fifty-fUSD shield on Diana
281189e64a9eaac6a36c457fdb9434ed1e669583 Confirm Diana's half-limit gas minimum from pinned fee-market parameters
1b02e6021c6b7b8d04c668fc561316b3c79872c1 Correct M1 scope and insertion-event terminology and preserve Claude's review

## Done-when checklist

Copied from docs/MILESTONES.md:

## M1 — Private payment round trip from code (Codex, 22–23 Nov)
Done when:
- [x] `packages/chain` wraps the SDK for chain 9800: shieldBound (native QOR), private send, unshield; window checks; tree sync from the pool’s insertion events (Shielded, Transferred) with paged `eth_getLogs`.
- [x] One scripted round trip on Diana: shield → send to a second account → that account unshields. Tx hashes in `evidence/m1-roundtrip.json`.
- [x] Unit tests for the wrapper; T-JOURNAL and T-NOTES behaviour for unknown broadcast outcomes.

## M1b — Funded fUSD conversion and shield (conditional on S13)
Done when:
- [x] Deployer sends 100 bank fUSD to business with a hybrid MsgSend; balances and transaction recorded in `evidence/m1b-fusd.json`.
- [x] S13 rerun with a funded business account; preserve chain code, codespace and a key-redacted rawLog of at most 500 characters on failure. The original zero-bank-balance attempt is not a valid conversion test.
- [x] If S13 confirms conversion, business approves and shields 50 fUSD; receipts and commitment in `evidence/m1b-fusd.json`. No further fUSD paths are built.

Review must-fixes:

- [x] Native failures preserve chain code/codespace and key-redacted rawLog, truncated to 500 characters; fUSD evidence retains those fields.
- [x] Fund business first, rerun a real 100-fUSD conversion, then conditionally shield 50. S13 corrected; original zero-bank attempt explicitly invalid as a conversion test.
- [x] Estimate gas, multiply by 1.25 with upward rounding, cap at 3M, and check the window against the signed limit. Run a real 1-QOR shield and update S06.
- [x] Correct the three requested documents, move fUSD to conditional M1b, tick completed milestones, and copy the review with its should-fixes due by M3.
- [x] All fix topics committed separately without rewriting history; final gate passed. M2 has not started.

## What changed

- `src/gas.ts`, `gateway.ts`: pinned eth_estimateGas; integer ceil(estimate × 1.25), capped at 3M; reject estimates already above the cap; sign exactly the checked limit.
- `src/journal.ts`, `executor.ts`, `evidence.ts`: persist estimate, estimation block, signed gas limit and fee cap before broadcast; include that metadata in public payment evidence.
- `src/nativeError.ts`, `native.ts`: preserve structured SDK, CheckTx and returned-receipt rejections; redact key material before truncation; do not attach the unsafe underlying error. Unknown transport errors keep null chain fields.
- `scripts/fusd.ts`, `fusdEvidence.ts` in packages/chain: record native failure details and observed hashes; read bank/ERC-20 snapshots at pinned heights; validate and scan public evidence.
- `scripts/m1b-fusd.ts`: hybrid-send 100 bank fUSD from deployer, convert 100, approve exactly 50, shield 50, verify receipt/tree inclusion and remaining ERC-20 balance. Existing evidence refuses another funded run.
- `scripts/m1-gas.ts`, `scripts/m1-gas-policy.ts`, package gas-policy reader: 1-QOR gas probe and read-only pinned fee-market configuration evidence.
- `test/gateway.test.ts`, `native.test.ts`, `fusd.test.ts`: gas rounding/cap/budget and signed-transaction checks; native diagnostics, redaction and conversion-evidence propagation.
- `test/tree.test.ts`: allow 30 seconds for real Poseidon initialization; the old 5-second timeout failed under CPU contention during the first test run.
- `AGENTS.md`, `briefing/PRD.md`, `briefing/FAILURE_MODES.md`: replace inaccurate Insert-log naming with the pool’s insertion events (Shielded, Transferred).
- `docs/MILESTONES.md`, `docs/reviews/M1-review.md`: native-QOR M1 complete; funded, conditional M1b complete; verbatim substantive review requirements and should-fixes due by M3.
- `briefing/REALITY_SPIKES.md`, CLAIMS, package README and AI records: real S06/S13 results, scope and evidence provenance.
- `evidence/m1-gas.json`, `m1-gas-policy.json`, `m1b-fusd.json`: produced by pnpm evidence. Original M1 evidence remains unchanged.

## Commands run and their real output

```text
$ pnpm evidence --m1-gas
> quaestor@ evidence /home/kingghidorah/Documents/projects/bounties/quaestor
> pnpm -C packages/chain exec tsx ../../scripts/evidence.ts "--m1-gas"

{
  "command": "pnpm evidence --m1-gas",
  "commit": "07ef35eb6dd0233534fe753b35f88b8b75de5f5c",
  "at": "2026-11-20T11:23:08.690Z",
  "demo": true,
  "network": "qorechain-diana",
  "pool": "0x27dD6Fd63B1CFdce96F6202B259E45A9587C8C55",
  "amountWei": "1000000000000000000",
  "window": {
    "hash": "7E05B87FA980D2E76DE97A42C04DEA9DCC2F911F443C35EEE12500398AE785AB",
    "height": 10430051,
    "gasUsed": "186749"
  },
  "payment": {
    "id": "gas-shield-one-qor",
    "hash": "0x8c4cab77c5fd99f5ff233b9f0fa3876ccdad2ba929ea814c5d7d35f278e66f12",
    "blockNumber": "10430070",
    "blockHash": "0x2e11bfa12475ea60bca6df55dd7dfda68d80447e8c67eca13104746ec27b5ac9",
    "gasUsed": "1080492",
    "effectiveGasPrice": "101000000000",
    "status": "success",
    "gas": {
      "estimatedGas": "1102576",
      "gasLimit": "1378220",
      "maxFeePerGas": "250000000000",
      "estimationBlock": "10430067"
    },
    "root": null,
    "nullifier": null,
    "feeWei": "0",
    "commitments": [
      "0x0316b120ccf72711fd4f50ae2ae791a6cca2c1a8226f51d849f9b6cd1a87d556"
    ],
    "plannedAt": "2026-11-20T11:22:43.119Z",
    "landedAt": "2026-11-20T11:23:08.493Z"
  },
  "feePaidWei": "109129692000000000",
  "halfGasLimit": "689110",
  "chargedExactlyHalfLimit": false,
  "chargedAtLeastHalfLimit": true
}
```

```text
$ pnpm evidence --m1-gas-policy
> quaestor@ evidence /home/kingghidorah/Documents/projects/bounties/quaestor
> pnpm -C packages/chain exec tsx ../../scripts/evidence.ts "--m1-gas-policy"

{
  "command": "pnpm evidence --m1-gas-policy",
  "commit": "2035d1ce27dcafe7f4e03b2229d4bc00c6be8089",
  "at": "2026-11-20T11:28:24.707Z",
  "network": "qorechain-diana",
  "requestedBlock": "10430288",
  "responseHeight": "10430288",
  "endpoint": "/cosmos/evm/feemarket/v1/params",
  "params": {
    "no_base_fee": false,
    "base_fee_change_denominator": 8,
    "elasticity_multiplier": 2,
    "enable_height": "0",
    "base_fee": "0.100000000000000000",
    "min_gas_price": "0.100000000000000000",
    "min_gas_multiplier": "0.500000000000000000"
  }
}
```

`pnpm evidence --m1b-fusd` returned 0. Relevant sections of the real output (other fields omitted):

```text
  "stage": "SHIELDED",
  "initial": {
    "block": "10430179",
    "businessBank": "0",
    "deployerBank": "1000000000",
    "businessToken": "0"
  },
  "afterFunding": {
    "block": "10430187",
    "businessBank": "100000000",
    "deployerBank": "900000000",
    "businessToken": "0"
  },
  "final": {
    "block": "10430209",
    "businessBank": "0",
    "deployerBank": "900000000",
    "businessToken": "50000000"
  },
```

The conversion section was:

```text
  "conversion": {
    "status": "CONVERTED",
    "before": "0",
    "after": "100000000",
    "bankBefore": "100000000",
    "bankAfter": "0",
    "errorCode": null,
    "code": null,
    "codespace": null,
    "rawLog": null,
    "transactionHash": "9DA1A1E5F911102D9FB11C73331B4791878F208B92E3D2B1E13775952315B18D",
    "at": "2026-11-20T11:25:56.515Z"
  },
```

The complete output data, including approval and shield receipts, is in evidence/m1b-fusd.json. Rejection fields are null because this funded conversion succeeded; no synthetic error is presented as a real-chain rejection.

```text
$ pnpm gate
> quaestor@ gate /home/kingghidorah/Documents/projects/bounties/quaestor
> pnpm typecheck && pnpm lint && pnpm test && pnpm -C contracts test


> quaestor@ typecheck /home/kingghidorah/Documents/projects/bounties/quaestor
> pnpm -r --if-present typecheck

Scope: 4 of 5 workspace projects
packages/chain typecheck$ tsc --noEmit
tools/evm-window typecheck$ tsc --noEmit
tools/evm-window typecheck: Done
packages/chain typecheck: Done

> quaestor@ lint /home/kingghidorah/Documents/projects/bounties/quaestor
> pnpm -r --if-present lint

Scope: 4 of 5 workspace projects

> quaestor@ test /home/kingghidorah/Documents/projects/bounties/quaestor
> pnpm -r --if-present test

Scope: 4 of 5 workspace projects
contracts test$ forge test
packages/chain test$ vitest run --maxWorkers=1 --minWorkers=1
contracts test: No files changed, compilation skipped
contracts test: Warning: No tests found in project! Forge looks for functions that start with `test`
contracts test: Done
packages/chain test:  RUN  v2.1.9 /home/kingghidorah/Documents/projects/bounties/quaestor/packages/chain
packages/chain test:  ✓ test/executor.test.ts (6 tests) 86ms
packages/chain test:  ✓ test/native.test.ts (4 tests) 47ms
packages/chain test:  ✓ test/gateway.test.ts (3 tests) 328ms
packages/chain test:  ✓ test/pool.test.ts (2 tests) 113ms
packages/chain test:  ✓ test/tree.test.ts (2 tests) 3799ms
packages/chain test:    ✓ T-TREE pages every deployment block and checks only the root at the pinned height 3773ms
packages/chain test:  ✓ test/fusd.test.ts (1 test) 83ms
packages/chain test:  ✓ test/prover.test.ts (1 test) 8173ms
packages/chain test:    ✓ T-PROVER verifies a real offline single-threaded shield proof against the self-hosted checking key 8159ms
packages/chain test:  ✓ test/config.test.ts (1 test) 25ms
packages/chain test:  Test Files  8 passed (8)
packages/chain test:       Tests  20 passed (20)
packages/chain test:    Start at  12:29:51
packages/chain test:    Duration  53.38s (transform 1.05s, setup 0ms, collect 30.07s, tests 12.65s, environment 8ms, prepare 3.53s)
packages/chain test: Done

> @quaestor/contracts@ test /home/kingghidorah/Documents/projects/bounties/quaestor/contracts
> forge test

No files changed, compilation skipped
Warning: No tests found in project! Forge looks for functions that start with `test`
```

The earlier test run failed on `T-TREE pages every deployment block and checks only the root at the pinned height` with `Test timed out in 5000ms.` The 30-second initialization allowance was added, and both subsequent full gate runs passed all 20 tests. No failed live transaction was hidden or replaced with a made-up result.

Additional checks: `git diff --cached --check` returned 0 before the docs commit; `git diff --exit-code a5a7727 -- contracts/vendor/gloam` returned 0 with no output. The targeted forbidden-path search returned 1 with no matches. Before writing this handoff, the local secret scan printed:

```text
PASS: 6 account mnemonics and 5 local note secrets absent from 149 tracked/evidence files
```

## On-chain evidence

| What | Tx hash / address | Block | Evidence file |
|---|---|---|---|
| 1-QOR window | `7E05B87FA980D2E76DE97A42C04DEA9DCC2F911F443C35EEE12500398AE785AB` | 10430051 | evidence/m1-gas.json |
| 1-QOR shield | `0x8c4cab77c5fd99f5ff233b9f0fa3876ccdad2ba929ea814c5d7d35f278e66f12` | 10430070 | evidence/m1-gas.json |
| 100-fUSD funding | `881210DD590D1E12CEAC456FC69EFDCC6B92B1E48B9D6478116196963E7EA1AA` | 10430186 | evidence/m1b-fusd.json |
| 100-fUSD conversion | `9DA1A1E5F911102D9FB11C73331B4791878F208B92E3D2B1E13775952315B18D` | 10430191 | evidence/m1b-fusd.json |
| fUSD window | `A6988C8A9180B53C38B60A114D4415A5F1AC618C4438382C516388B47947DF92` | 10430196 | evidence/m1b-fusd.json |
| 50-fUSD approval | `0x447c475dbe04f88205fa92d4aead012254c2c9e3548b9047feda7607860375fb` | 10430200 | evidence/m1b-fusd.json |
| 50-fUSD shield | `0x2c5947b82f9987b8dac1ddc6480cb4cedcdabaffa08fe74af1963028bbdef762` | 10430208 | evidence/m1b-fusd.json |
| Half-limit minimum configuration | `min_gas_multiplier = 0.500000000000000000` | 10430288 (matching response height) | evidence/m1-gas-policy.json |

fUSD asset: `0x97143B771D34ddb9130b807b135Ae675A5a963CA`, six decimals. Bank denom: `erc20:0x97143B771D34ddb9130b807b135Ae675A5a963CA`. Pool: `0x27dD6Fd63B1CFdce96F6202B259E45A9587C8C55` on Diana, chain 9800. Shielded 50-fUSD commitment: `0x12c30543d7f2be03c99c01800157b7d5a969ea5efaa0ed4c43f75a1841fa9832`. Its note secret stays in the git-ignored local journal.

The 1-QOR shield estimated 1,102,576 gas, signed 1,378,220, used 1,080,492 and paid 0.109129692 QOR at 101 gwei. This fee is the EVM receipt fee, separate from the native window-opening fee. Its half-limit floor is 689,110; actual use was higher. The fee-market snapshot confirms a configured minimum of half the gas limit, matching M1's old 1.5M charges from 3M limits.

Funding decreased deployer bank fUSD from 1,000 to 900 and increased business bank fUSD from 0 to 100. Conversion burned 100 bank fUSD and minted 100 ERC-20 fUSD. After shielding 50, business has 50 ERC-20 fUSD plus the privately held 50-fUSD pool note. No further fUSD paths were built or exercised.

## Not done / known problems

- Review should-fixes remain due by M3: add ESLint with typescript-eslint strict and no-explicit-any; cache tree sync in included(). They were recorded, not promoted to extra must-fixes or silently claimed complete.
- The root lint step currently has no workspace lint tasks. Forge still reports no contract tests. A passing gate does not establish those absent checks.
- The first M1 conversion attempt ran with a zero bank balance and was not a real conversion test. Its legacy CONVERSION_FAILED remains in historical evidence; the funded M1b result supersedes it.
- Native funding/conversion steps are not automatically replayed. The M1b runner refuses an existing evidence file; inspect existing receipts and held EVM journal operations before any later run.
- Account files, circuits and note journal remain untracked local prerequisites. Retain the journal privately to keep the new 1-QOR and 50-fUSD notes.
- No M2 implementation, sealed ticket, new browser flow or further fUSD path was added. Groth16 remains non-post-quantum.

## Conflicts with the PRD or the spikes

- Requested documentation corrections resolve the old Insert-log naming and native-QOR/fUSD milestone mismatch; payment/verdict design was not changed.
- S13 is now confirmed from a funded test, rather than treating the unfunded M1 attempt as a valid failure of the conversion integration.
- S06 initially described the half-limit minimum as an inference. The subsequent pinned fee-market query confirmed its configured value; both the transaction and configuration observations are retained.
- Evidence commit fields record HEAD at execution. Gas logic is in 07ef35e, the funded runner is in 2035d1c, and the read-only policy reader was written during the query and committed in 281189e. These fields do not claim a clean working tree at execution.

## Questions for Claude / the builder

No unresolved must-fix question. Review these fixes and retain the two should-fixes for completion by M3. M2 remains unstarted.
