# MILESTONES

Codex works one milestone at a time. Each ends with `docs/handoff/M<n>.md`, then a Claude review in `docs/reviews/M<n>-review.md`. Must-fix items are cleared before the next milestone starts. Dates are targets (PLAN.md).

## M0 — Private rail live on QoreChain testnet (builder + Codex, 21–22 Nov)
Run by the builder on their machine; Codex fixes scripts if they fail.
Done when:
- [x] `scripts/day2/make-demo-accounts.mjs` made the six accounts; each funded from the faucet; ML-DSA-87 key registered for the deployer (`tools/evm-window`, `pnpm window register`).
- [x] `scripts/day2/s03-bn254-precompiles.mjs` passes all 4 vectors against Diana's EVM RPC (output saved to spikes/s03-output.txt).
- [x] PoseidonT3 deployed (`scripts/day2/deploy-poseidon.mjs`); address in `.env` as POSEIDON2.
- [x] Pool, verifiers and memo board deployed with `contracts/script/DeployQuaestorPool.s.sol`; addresses and tx hashes in `evidence/m0-deploy.json`.
- [x] `scripts/day2/s04-check-verifiers.mjs` shows Diana's deployed shield verifier accepts a fresh real proof and rejects a tampered one (spikes/s04-output.txt).
- [x] REALITY_SPIKES.md rows S03, S04, S04v, S14 confirmed live (S05–S07 move to M1; S09, S10, S12, S13 to M1/M2).

**M0 closed 2026-11-20 10:32 UTC.**

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

## M2 — Post-quantum tickets (Codex, 23–24 Nov)
Done when:
- [x] In-app account onboarding primitives in code (M2 scripts; browser onboarding remains M6): register ML-KEM-1024 key, sign + publish a recipient card.
- [x] Ticket = Gloam note package sealed with QoreSeal hybrid to the payee's registry key + card, posted to our memo board; payee scans, opens, verifies the commitment is in the tree.
- [x] Tests: T-TICKET-NO-CLASSICAL-FALLBACK, ticket fits 8,192 B, outsider can't open, wrong AAD refused.
- [x] Round trip of M1 repeated with a PQ ticket; evidence/m2-ticket.json.

## M3 — Sealed books and grants (Codex, 24–25 Nov)
Done when:
- [ ] `packages/core`: entry codec, period keys, grant and close records; ML-DSA-87 signatures via QoreSign.
- [ ] `contracts/Books.sol` + Foundry tests (T-BOOKS-*), deployed on Diana.
- [ ] Entries anchored for M2's payments; a grant for one period to the auditor account.

## M4 — Verdict engine and reconciliation decision (Codex + Claude, 25–26 Nov)
Done when:
- [ ] Verdict engine per PRD §8 with every verdict produced on constructed inputs (ceiling check), including the old-root case.
- [ ] Ablations from EVAL_DESIGN (context check, root history) show what each check catches.
- [ ] DECISIONS D5 written: reconciliation design proven on an honest vs hidden-payment period, or shipped as NOT PROVEN.

## M5 — Store and end-to-end evidence run (Codex, 26 Nov)
Done when:
- [ ] `apps/store` (ciphertext only, T-NOPLAIN-STORE).
- [ ] `pnpm evidence` runs pay → ticket → entry → anchor → grant → audit against Diana and writes evidence/.

## M6 — Web app: accounts, pay, business books (Codex, 27 Nov)
## M7 — Web app: auditor, public check, attack lab (Codex, 28–29 Nov)
Done when (M6+M7):
- [ ] Every demo act in PRD §11 works in the browser; T-NOPLAIN-WEB passes in Playwright; checked at 390 px.

## M8 — Audit, docs, video (builder + Claude + Codex, 29 Nov – 2 Dec)
- [ ] QCAI stage 1 and 2 on Books.sol; docs/AUDIT.md.
- [ ] README with the requirements-with-evidence table; CLAIMS.md updated; THREAT_MODEL.md; JUDGES.md; HOW_ITS_MADE.md final; AI_USAGE.md complete.
- [ ] Video ≤ 3:00; cover image; pre-submit audit from a clean clone; final push before 2 Dec 20:00 UTC.
