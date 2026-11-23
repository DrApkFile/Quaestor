# QCAI audit — prepared inputs, audit pending

Scope: Books v2 at `0x9775c1d0dc814e41fb1b38d26fa17f60d24faf64` and BlobBoard at `0xe79e5a3108d8e856aa7ac770c97ac7af308c1d67` on Diana (qorechain-diana, EVM 9800). Upload `docs/audit/Books.flat.sol` and `docs/audit/BlobBoard.flat.sol` separately. Books includes its precompile interfaces. Gloam's vendored contracts are excluded because they are unmodified and audited upstream; this scope does not independently validate that upstream audit or make Groth16 post-quantum.

The builder runs the audit at https://dashboard.qorechain.io. Select Blockchain: the EVM/Ethereum option. Use exactly the same Blockchain setting in both stages, Solidity 0.8.24, Shanghai, optimizer enabled with 200 runs where those settings are available. Record the actual dashboard option names and report identifiers when run.

1. Stage 1: submit both flattened files; retain both complete reports with input hashes, settings and timestamps.
2. Triage every finding below. Fix accepted findings in separate behavioural commits, add relevant tests, and explain any finding not changed. No contract behaviour fixes are authorized by M10; bring such findings to the builder before changing deployed behaviour.
3. Regenerate and independently compile inputs after fixes. Run gate, then stage 2 with identical dashboard settings. Retain both reports and map every original finding to its fix or explanation and regression test. Do not claim completion until stage 2 reports are reviewed.

| ID | severity | title | our response (fixed in <commit> / explained) | test |
|---|---|---|---|---|

No QCAI audit has been run by Codex. No findings or reports are implied by the empty table.

Regenerate with `pnpm evidence --m10-audit`. Each flattened file compiles alone in a temporary Forge root with solc 0.8.24, without repository imports. The header records the source git commit and deployment address. A literal full-file hash cannot include itself: the header's SHA-256 hashes the complete UTF-8 file with that hash field normalized to 64 zeros. `evidence/m10-audit.json` also records the final file's ordinary SHA-256, exact commands and real compiler output. The source commit is the input checkout; generated files land in a later commit.
