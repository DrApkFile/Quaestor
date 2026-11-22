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
- [x] In-app account onboarding primitives in code (M2 scripts; browser onboarding completed in M5): register ML-KEM-1024 key, sign + publish a recipient card.
- [x] Ticket = Gloam note package sealed with QoreSeal hybrid to the payee's registry key + card, posted to our memo board; payee scans, opens, verifies the commitment is in the tree.
- [x] Tests: T-TICKET-NO-CLASSICAL-FALLBACK, ticket fits 8,192 B, outsider can't open, wrong AAD refused.
- [x] Round trip of M1 repeated with a PQ ticket; evidence/m2-ticket.json.

## M3 — Sealed books and grants (Codex, 24–25 Nov)
Done when:
- [x] `packages/core`: entry codec, period keys, grant and close records; ML-DSA-87 signatures via QoreSign.
- [x] `contracts/src/Books.sol` + Foundry tests (T-BOOKS-*), deployed on Diana.
- [x] Entries anchored for M2's payments; a grant for one period to the auditor account.

M3 script evidence: `evidence/m3-books.json`; fresh auditor opens A (2 entries), is refused B (1 entry). Anonymous ticket correction: `evidence/m2b-ticket-anonymous.json`; historical M2 evidence retained. Browser workflows and receipt verdicts remain M4–M7.

## M4 — Verdict engine and reconciliation decision (Codex + Claude, 25–26 Nov)
Done when:
- [x] Verdict engine per PRD §8 with every verdict produced on constructed inputs (ceiling check), including the old-root case.
- [x] Ablations from EVAL_DESIGN (context check, root history) show what each check catches.
- [x] DECISIONS D5 written: scoped holdings coverage proven on the honest and inflated demo closes; no complete-reconciliation claim.

Evidence: `evidence/m4-verdicts.json` and `evidence/m4-ablations.json`. All three granted A entries MATCHED; holdings covered at A’s close block; B refused. The attack lab exposes tampering, reused-receipt context failure and insufficient proof coverage. Books v2 deployment and v1 address are in `evidence/m4-books-v2.json`.

## M5 — Chain storage and read-only web foundations (Codex, 21 Nov)
Done when (builder's replacement brief, D14/D15):
- [x] Duplicate-payment ceiling test and C4 scope limitation.
- [x] Ownerless BlobBoard deployed; bounded, validated ciphertext posting and paged SHA3-verified reads.
- [x] M4 ciphertexts/cards and legacy owner-signed mappings posted; fresh auditor reproduces M4 without local ciphertexts.
- [x] S08/S17 real browser spikes, allowlisted CORS pass-through and browser shield proof timing.
- [x] Encrypted IndexedDB vault, mandatory encrypted backup and chain-driven onboarding.
- [x] Public check and Auditor read the M4 book from chain; lazy cached circuits and download progress.
- [x] Unit tests, production build, live Playwright request interception and 390px/desktop checks pass.
- [x] Gate passes and handoff is written; final delivery is the handoff commit push, then stop before M6.

## M6 — Web app: accounts, pay, business books (Codex, 22 Nov)
Builder's approved scope: docs/briefs/M6.md. M7 attack-lab UI remains separate.
- [x] Read-only Muuve style study, licensed assets, theme tokens, landing and seven-view dashboard; README credit.
- [x] Browser wallet, anonymous Pay/Receive, ciphertext-anchored books, close and irreversible grants obey M1–M5 invariants.
- [x] Encrypted journal unit tests prove unknown outcomes remain held without rebuilding.
- [x] T-NOPLAIN-WEB inspects all requests/responses for entry/invoice canaries and account/seal/note secrets.
- [x] Live three-context daily demo books the 1/.5/.25-QOR journey, closes/grants A, reproduces all MATCHED and HOLDINGS_COVER_BOOKS, refuses populated B.
- [x] evidence/m6-browser.json and landing/dashboard/every-screen screenshots at 390px and desktop; scoped C5 evidence.
- [ ] pnpm gate and production build pass; handoff written; pushed, stop before M7.

## M7 — Web app: attack lab (Codex, 28–29 Nov)
- [ ] Browser attack-lab demonstrations from PRD §11; independently briefed and reviewed after M6.

## M8 — Audit, docs, video (builder + Claude + Codex, 29 Nov – 2 Dec)
- [ ] QCAI stage 1 and 2 on Books.sol; docs/AUDIT.md.
- [ ] README with the requirements-with-evidence table; CLAIMS.md updated; THREAT_MODEL.md; JUDGES.md; HOW_ITS_MADE.md final; AI_USAGE.md complete.
- [ ] Video ≤ 3:00; cover image; pre-submit audit from a clean clone; final push before 2 Dec 20:00 UTC.
