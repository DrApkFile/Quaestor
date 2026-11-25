# QCAI audit — Books stage 1 triaged; later reports pending

Scope: Books v2 at `0x9775c1d0dc814e41fb1b38d26fa17f60d24faf64` and BlobBoard at `0xe79e5a3108d8e856aa7ac770c97ac7af308c1d67` on Diana (qorechain-diana, EVM 9800).

Gloam's contracts (contracts/vendor/gloam/, upstream commit d8db1e6, MIT) are out of this audit's scope. They are third-party code used unmodified, and scripts/vendor-gloam.sh checks them byte-for-byte against SHA256SUMS. Because we never modify them, findings there could not be fixed in this repository. Our responsibility is our deploy script and configuration (contracts/script/DeployQuaestorPool.s.sol: deposit limits, verifier wiring, endSetup), covered by the deployment evidence. Groth16/BN254 is not post-quantum.

Deployment evidence: [M0 deployed contracts and configuration receipts](../evidence/m0-deploy.json).

The builder uses the free daily audit only at https://dashboard.qorechain.io. Actual setting: **Framework EVM/Solidity**, the same in both stages. The PDF renders Blockchain as `ethereum`. Compiler settings for our independent compilations: Solidity 0.8.24, Shanghai, optimizer enabled, 200 runs. Dashboard compiler controls beyond Framework were not recorded; do not assume they were exposed or selected.

## Books v2 stage 1 — 25 Nov 2026

[Exported PDF](audit/stage1-Books.pdf) is the report of record; the dashboard offered no public report link. Score **65/100**, risk **HIGH**, quantum safe **Not scored**, five findings. The PDF displays Generated 11/25/2026, 7:27:10 PM (timezone unspecified). Claude's triage was provided by the builder; the regression tests below were run locally by Codex. The score is the auditor's result, not our corrected score or a security certification.

| ID | severity | title | auditor's claim | what the code does | verdict | test |
|---|---|---|---|---|---|---|
| Q1 | HIGH | Missing access control on anchorEntry/anchorGrant | Ownership checks permit unauthorized changes | Ownership is the authorization rule: requireOwner rejects every sender except books[book], the registering address | False positive | `testQ1UnauthorizedCallsPreserveState`: entry, grant and close revert NotOwner; count, hashes, grant, new entry and close stay unchanged |
| Q2 | MEDIUM | Overflow in index + 1 | uint64 maximum could wrap nextIndex | Solidity 0.8.24 checked addition panics 0x11 and rolls back all writes; reaching this boundary naturally would require 2^64 entries in a period | False positive | `testQ2MaximumIndexPanicsAndRollsBack`: vm.store maximum index; next append panics 0x11; period and anchor unchanged |
| Q3 | MEDIUM | Unchecked pqcKeyStatus/pqcVerify returns | Failed calls allow execution with bad assumptions | Unregistered or non-2592-byte key gives NoPqKey; algorithm other than 1 gives WrongAlgorithm; missing possession gives PossessionNotProven; false verify gives BadSignature. Missing or malformed return data reverts on ABI decode (or the compiler's external-code check), failing closed | False positive | `testRegistrationRequiresProvenAlgorithmOne`, `testQ3WrongLengthKeyFailsClosed`, `testBadSignatureRefusedAndPeriodRemainsOpen`, `testQ3MissingKeyPrecompileFailsClosed`, `testQ3MissingVerifyPrecompileFailsClosed` |
| Q4 | LOW | Front-running book registration | An attacker can register your salt first | ID is keccak256(abi.encodePacked(msg.sender, salt)); a different sender gets a different ID | False positive | `testQ4SameSaltCannotTakeAnotherOwnersBook`: attacker registers first with same salt; owner then registers successfully; IDs and owners differ |
| Q5 | INFO | Unbounded nested mappings exhaust gas | Growing mappings make each access more expensive | Mapping slots are calculated directly; access does not traverse existing keys. Books never loops over a mapping. Cold/warm access and zero/nonzero writes affect gas, not total mapping size | Informational, no risk from mapping growth | No test needed: bounded direct accesses by source inspection |

Tests: [Books.t.sol](../contracts/test/Books.t.sol). No finding required a logic change, so the deployed contracts were not redeployed.

## Inputs and equivalence

Stage 1 [Books](audit/Books.flat.sol) and [BlobBoard](audit/BlobBoard.flat.sol) are unchanged. Stage 2 [Books](audit/Books.stage2.flat.sol) and [BlobBoard](audit/BlobBoard.stage2.flat.sol) add NatSpec only. Each compiles alone, including the Books precompile interface, with solc 0.8.24.

Headers record source checkout commit and deployment address. The SHA-256 header covers the complete UTF-8 file with its own hash field normalized to 64 zeros; it cannot be a literal self-containing hash. [M10 evidence](../evidence/m10-audit.json) retains the stage 1 ordinary hashes and independent compile output. [M11 bytecode equivalence](../evidence/m11-bytecode-equivalence.json) retains stage 1/2 ordinary hashes, exact compiler commands/output and pinned eth_getCode for both deployments.

`pnpm evidence --m11-bytecode` compiles stage 1, stage 2 and current sources with CBOR disabled and requires byte-identical runtime. Deployed CBOR is length-decoded and removed. Solc omits the terminal `fe` INVALID metadata separator under `--no-metadata`; the check requires the remaining deployed bytes to equal the compiled runtime plus exactly this separator. No executable difference is ignored. `pnpm bytecode:check` repeats all six isolated compiles offline against the retained code and rejects source, header, evidence or runtime drift; it is part of gate. Regeneration rereads both contracts at one pinned block, without transactions.

## Builder report schedule

| Contract | Stage | Date (2026) | Record / status |
|---|---|---|---|
| Books | 1 | 25 Nov | [PDF received](audit/stage1-Books.pdf), triaged above |
| BlobBoard | 1 | 26 Nov | Pending builder upload: `docs/audit/stage1-BlobBoard.pdf` |
| Books | 2 | 27 Nov | Pending builder upload: `docs/audit/stage2-Books.pdf` |
| BlobBoard | 2 | 28 Nov | Pending builder upload: `docs/audit/stage2-BlobBoard.pdf` |

These placeholders do not imply audits were run or findings reviewed. The builder uploads each exported PDF. Stage 2 must use Framework EVM/Solidity again, free daily audit only, and original findings must be mapped to the resulting report before claiming two-stage completion.
