# Briefing: Quaestor — Build Before Q-Day (Encrypted Apps)

Prepared 2026-11-20. Solo. Normal web app. Private rail = our own deployment of Gloam's open-source shielded pool (MIT) on QoreChain testnet.

**Pitch:** Pay and get paid privately on QoreChain. Every payment writes a book entry sealed with post-quantum encryption. Grant your auditor one quarter; they read exactly that quarter and check every entry against the chain. *Private to the world. Open to your auditor. One quarter at a time.*

## Read in this order
1. EVENT.md — rules, dates, acceptance IDs, 5 questions for organisers.
2. LANDSCAPE.md — neighbours (Veil is closest) and the gap.
3. IDEA_CHECK.md — hook, hard core, boundary, what we don't claim.
4. EVAL_DESIGN.md — claims C1–C6 and how each could fail.
5. knowledge/gloam.md, knowledge/qoreseal.md, knowledge/qorechain-evm-pqc.md — primary-source notes.
6. REALITY_SPIKES.md — S01, S02 confirmed offline; S03–S12 on your machine (day 2–3).
7. FAILURE_MODES.md.
8. PRD.md — single source of truth.
9. BUILD_CONTRACT.md, ../AGENTS.md, code-bar.md.
10. PLAN.md — day by day, cut list, what to do if the rail is blocked.
11. pre-submit-audit.md — 2 Dec, from a clean clone.

## Verified so far (20 Nov, offline)
- S01: QoreSeal envelopes can be checked against public on-chain keys; wrong key refused.
- S02: `@gloamtrade/sdk@0.8.0` builds a real shield proof for chain id 9800 with our own pool address, and it verifies against Gloam's final key (~1 s in Node, single-threaded).
- Gloam's pool is ~11.9 KB (under 24 KB), its verifiers need BN254 precompiles 0x06–0x08, final circuit keys ship in its repo (self-hostable), licence MIT.

## Biggest open risks
1. BN254 precompiles and pool deploy on Diana (S03/S04).
2. Log history for tree sync on Diana's RPC (S07).
3. Reconciliation soundness (D5).
4. Organisers' view on deploying third-party MIT contracts (EVENT Q5).
