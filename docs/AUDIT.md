# QCAI two-stage audit — all findings answered

Scope: Books v2 at `0x9775c1d0dc814e41fb1b38d26fa17f60d24faf64` and BlobBoard at `0xe79e5a3108d8e856aa7ac770c97ac7af308c1d67` on Diana (qorechain-diana, EVM 9800).

Gloam's contracts (contracts/vendor/gloam/, upstream commit d8db1e6, MIT) are out of this audit's scope. They are third-party code used unmodified, and scripts/vendor-gloam.sh checks them byte-for-byte against SHA256SUMS. Because we never modify them, findings there could not be fixed in this repository. Our responsibility is our deploy script and configuration (contracts/script/DeployQuaestorPool.s.sol: deposit limits, verifier wiring, endSetup), covered by the deployment evidence. Groth16/BN254 is not post-quantum.

Deployment evidence: [M0 deployed contracts and configuration receipts](../evidence/m0-deploy.json).

The builder uses the free daily audit only at https://dashboard.qorechain.io. Actual setting: **Framework EVM/Solidity**, in all four runs. The PDF renders Blockchain as `ethereum`. Compiler settings for our independent compilations: Solidity 0.8.24, Shanghai, optimizer enabled, 200 runs. Dashboard compiler controls beyond Framework were not recorded; do not assume they were exposed or selected.

## Results

No public report links were offered; these four builder-exported PDFs are the record. The dashboard showed **Quantum Safe: Not scored** in all four runs. No post-quantum score is claimed: see [PQ parameters](PQ_PARAMETERS.md) for actual algorithms, modes and limits. Scores are the AI auditor's results, not a security certification.

| Contract | Stage / date (2026) | Framework | Score | Risk | Findings | PDF |
|---|---|---|---|---|---|---|
| Books v2 | 1 / 25 Nov | EVM/Solidity | 65 | HIGH | 5 | [Stage 1](audit/stage1-Books.pdf) |
| Books v2 | 2 / 27 Nov | EVM/Solidity | 75 | MEDIUM | 4 | [Stage 2](audit/stage2-Books.pdf) |
| BlobBoard | 1 / 26 Nov | EVM/Solidity | 85 | LOW | 2 | [Stage 1](audit/stage1-BlobBoard.pdf) |
| BlobBoard | 2 / 28 Nov | EVM/Solidity | 95 | LOW | 0 | [Stage 2](audit/stage2-BlobBoard.pdf) |

Stage 2 sources differ only by NatSpec comments; [bytecode equivalence](../evidence/m11-bytecode-equivalence.json) proves unchanged logic against deployed runtime. Stage 2 findings mostly reword stage 1 findings, as expected when an AI auditor reruns on unchanged logic. No logic change or redeployment was needed.

## Books v2 stage 1 — 25 Nov 2026

[Exported PDF](audit/stage1-Books.pdf) is the report of record; the dashboard offered no public report link. Score **65/100**, risk **HIGH**, quantum safe **Not scored**, five findings. The PDF displays Generated 11/25/2026, 7:27:10 PM (timezone unspecified). Claude's triage was provided by the builder; the regression tests below were run locally by Codex. The score is the auditor's result, not our corrected score or a security certification.

| ID | severity | title | auditor's claim | what the code does | verdict | test |
|---|---|---|---|---|---|---|
| Q1 | HIGH | Missing access control on anchorEntry/anchorGrant | Ownership checks permit unauthorized changes | Ownership is the authorization rule: requireOwner rejects every sender except books[book], the registering address | False positive | `testQ1UnauthorizedCallsPreserveState`: entry, grant and close revert NotOwner; count, hashes, grant, new entry and close stay unchanged |
| Q2 | MEDIUM | Overflow in index + 1 | uint64 maximum could wrap nextIndex | Solidity 0.8.24 checked addition panics 0x11 and rolls back all writes; reaching this boundary naturally would require 2^64 entries in a period | False positive | `testQ2MaximumIndexPanicsAndRollsBack`: vm.store maximum index; next append panics 0x11; period and anchor unchanged |
| Q3 | MEDIUM | Unchecked pqcKeyStatus/pqcVerify returns | Failed calls allow execution with bad assumptions | Unregistered or non-2592-byte key gives NoPqKey; algorithm other than 1 gives WrongAlgorithm; missing possession gives PossessionNotProven; false verify gives BadSignature. Missing or malformed return data reverts on ABI decode (or the compiler's external-code check), failing closed | False positive | `testRegistrationRequiresProvenAlgorithmOne`, `testQ3WrongLengthKeyFailsClosed`, `testBadSignatureRefusedAndPeriodRemainsOpen`, `testQ3MissingKeyPrecompileFailsClosed`, `testQ3MissingVerifyPrecompileFailsClosed` |
| Q4 | LOW | Front-running book registration | An attacker can register your salt first | ID is keccak256(abi.encodePacked(msg.sender, salt)); a different sender gets a different ID | False positive | `testQ4SameSaltCannotTakeAnotherOwnersBook`: attacker registers first with same salt; owner then registers successfully; IDs and owners differ |
| Q5 | INFO | Unbounded nested mappings exhaust gas | Growing mappings make each access more expensive | Mapping slots are calculated directly; access does not traverse existing keys. Books never loops over a mapping. Cold/warm access and zero/nonzero writes affect gas, not total mapping size | Informational, no risk from mapping growth | `testS2_3OneBooksGrowthCannotWriteAnotherBook`; bounded direct accesses by source inspection |

Tests: [Books.t.sol](../contracts/test/Books.t.sol). No finding required a logic change, so the deployed contracts were not redeployed.

## Inputs and equivalence

Stage 1 [Books](audit/Books.flat.sol) and [BlobBoard](audit/BlobBoard.flat.sol) are unchanged. Stage 2 [Books](audit/Books.stage2.flat.sol) and [BlobBoard](audit/BlobBoard.stage2.flat.sol) add NatSpec only. Each compiles alone, including the Books precompile interface, with solc 0.8.24.

Headers record source checkout commit and deployment address. The SHA-256 header covers the complete UTF-8 file with its own hash field normalized to 64 zeros; it cannot be a literal self-containing hash. [M10 evidence](../evidence/m10-audit.json) retains the stage 1 ordinary hashes and independent compile output. [M11 bytecode equivalence](../evidence/m11-bytecode-equivalence.json) retains stage 1/2 ordinary hashes, exact compiler commands/output and pinned eth_getCode for both deployments.

`pnpm evidence --m11-bytecode` compiles stage 1, stage 2 and current sources with CBOR disabled and requires byte-identical runtime. Deployed CBOR is length-decoded and removed. Solc omits the terminal `fe` INVALID metadata separator under `--no-metadata`; the check requires the remaining deployed bytes to equal the compiled runtime plus exactly this separator. No executable difference is ignored. `pnpm bytecode:check` repeats all six isolated compiles offline against the retained code and rejects source, header, evidence or runtime drift; it is part of gate. Regeneration rereads both contracts at one pinned block, without transactions.

## BlobBoard stage 1

[PDF](audit/stage1-BlobBoard.pdf), generated 11/26/2026 2:55:38 AM (timezone unspecified).

| ID | Severity / finding | Answer | Test |
|---|---|---|---|
| B1 | LOW — Missing Data Storage | By design (D14): event storage is cheaper than contract storage and immutable once final. Books anchors each blob's SHA3; a changed or substituted blob gives TAMPERED. Old logs require a node keeping full history: pruned RPCs can make records unreadable, never forgeable. See [threat model](../THREAT_MODEL.md). | `testAcceptsBoundaryAndAnyPosterWithoutStorage`; `T-BIND edited ciphertext fails the anchor SHA3 and signature even if its stated digest is replaced` in [core tests](../packages/core/test/books.test.ts) |
| B2 | INFO — Unbounded Event Data | False premise: post accepts only 1–24,576 bytes; larger blobs revert BlobTooLarge. The poster pays calldata and log gas per byte. | `testRejectsEmptyData`, `testRejectsMoreThan24576Bytes`, `testAcceptsBoundaryAndAnyPosterWithoutStorage` in [BlobBoard tests](../contracts/test/BlobBoard.t.sol) |

## Books stage 2

[PDF](audit/stage2-Books.pdf), generated 11/27/2026 1:03:29 AM (timezone unspecified).

| ID | Severity / finding | Stage 1 mapping / answer | Test |
|---|---|---|---|
| S2-1 | HIGH — Potential Privilege Escalation via Owner Check | Q4, false positive. ID is keccak256(abi.encodePacked(msg.sender, salt)); front-running with the same salt creates a different book. Owner authorization also rejects unauthorized writes (Q1). | M11 `testQ4SameSaltCannotTakeAnotherOwnersBook`, `testQ1UnauthorizedCallsPreserveState` |
| S2-2 | MEDIUM — Potential Overflow in Index Increment | Q2, false positive. Checked addition already reverts and rolls back. An explicit check would give the same revert behavior and require redeployment for no security gain. | M11 `testQ2MaximumIndexPanicsAndRollsBack` asserts panic 0x11 and unchanged state |
| S2-3 | LOW — Unbounded Storage Writes | Q5, false positive. Only the owner writes their book and pays gas. There is no shared iteration; one book's growth cannot affect another. | `testS2_3OneBooksGrowthCannotWriteAnotherBook`, `testQ1UnauthorizedCallsPreserveState` |
| S2-4 | INFO — Missing Input Validation for Signature Verification | Valid observation, no risk: the precompile rejects invalid signatures and Books fails closed. Local tests mock the exact precompile boundary; real crypto is checked separately by pinned live calls with the public M12 key/signature. | `testS2_4TruncatedAndEmptySignaturesRevertBadSignatureAndPreserveOpenPeriod`: 4,626-byte and empty signatures both revert BadSignature, leaving the period open; [live evidence](../evidence/m13-short-signature.json) includes valid control, truncated and empty probes |

All Books regression tests: [Books.t.sol](../contracts/test/Books.t.sol). The live probe sends no transaction and uses no secrets.

## BlobBoard stage 2

[PDF](audit/stage2-BlobBoard.pdf), generated 11/28/2026 1:04:47 AM (timezone unspecified): **95/100 LOW, zero findings**. The executive summary mentions possible spam. Anyone may post, each post costs its poster gas, and readers trust only blobs anchored in Books by the book owner. Spam cannot add records to a book. `testPostedHashIsUntrustedMetadata` and `testAcceptsBoundaryAndAnyPosterWithoutStorage` establish the board boundary; `testQ1UnauthorizedCallsPreserveState` establishes the owner-only anchor boundary.
