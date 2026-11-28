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
- [x] pnpm gate and production build pass; handoff written. Final delivery is the handoff commit push, then stop before M7.

## M7 — Web app: attack lab (Codex, 28–29 Nov)
Builder's approved scope: docs/briefs/M7.md, including the M6 review fixes.
- [x] Readable owner/auditor ledgers, proof details, copy and plural fixes.
- [x] Encrypted account-plus-journal backup restores private balance in a fresh browser; held outcomes resolve by original hash.
- [x] D17 signed declared openings support B-only auditing; C6 states the limit.
- [x] Live read-only attack lab reproduces M4 tampering/context/short holdings and a separately anchored fresh-receipt duplicate.
- [x] Northwind Studio (demo): daily A/B closed and granted, five MATCHED entries and both holdings checks; populated C refused.
- [x] Public encrypted testnet auditor backup and a real-link 60-second JUDGES.md path.
- [x] T-NOPLAIN-WEB and every screen at 390/1440; evidence/m7-screens/.
- [x] Production relay build, explicit Vercel API routing/CSP verification and docs/DEPLOY.md.
- [x] pnpm gate passes; handoff written. Final delivery is the handoff commit’s push, then stop before M8.

## M8 — Submission readiness (current builder brief)
Current brief: docs/briefs/M8.md. The original external checks remain open below; a passing repository audit does not close the festival submission.
- [x] Separate Privacy test (demo) canary journey retains masked evidence; fictional Northwind M7b has A/B closed/granted, C open/refused, five MATCHED entries and both holdings checks in a fresh browser.
- [x] M7b captures every view at 390/1440 without masking; OCR plus visible-text secret scan passes. First Northwind remains recorded as superseded: canary content.
- [x] JUDGES, landing links and scoped claims point at the new book.
- [x] Judge README explains four encryption requirements and ten QoreChain features with real receipts; claims gate enforces reviewed mappings to PROVEN support.
- [x] Final technical story is under 250 words; AI_USAGE records the review loop, concrete corrections, Claude's own mistakes and generated/human work.
- [x] A ≤2:50 recording script identifies screens/evidence; original 1600×900 cover is under 5 MB with no third-party logos.
- [x] Fresh account-free clone → frozen install → circuits + pinned forge-std → gate → production build passes; exact output in evidence/m8-presubmit.txt; full audit discloses external open items.
- [x] CLAIMS, milestones and AI log reflect observed results; handoff written. Final delivery is the handoff commit push, then stop.

Original external M8 checks, still open:
- [x] Two-stage QCAI audit on Books and BlobBoard: four PDFs and all responses in docs/AUDIT.md (M13). No post-quantum score was offered.
- [ ] Final recorded video, independent human judge walkthrough and external project-page/eligibility/submission actions remain unperformed. Public hosting was subsequently verified in M9.

## M9 — Live deployment, readable UX and one-step activation

Builder brief: [docs/briefs/M9.md](briefs/M9.md). Prior milestones through M8 are approved by Claude per the builder.
- [x] Save the entire builder message before implementation, in its own commit.
- [x] Record deployed curl/header checks and run the live judge path; preserve initial failures.
- [x] Fix routing and verify the allowed registry query and refused path on the deployed origin.
- [x] Readable verdicts, one-click demo auditor, navigation, empty/wait/error states, balance clarity and responsive accessibility pass on the live site.
- [x] Report route/bundle sizes before and after; lazy circuits/crypto remain scoped to need.
- [x] One-button chain-driven activation, manual faucet instructions, polling, receipt details and resumable failures.
- [x] Run `pnpm evidence --m9-fresh-signup` on the deployed site with two empty contexts and manual funding; record the actual outcome without inventing receipts or costs.
- [x] Intercept all exercised requests/responses and scan all 390/1440 screenshots for known secrets.
- [x] Update scoped claims only if the full fresh flow passes; update judge/readme/story/video/AI docs.
- [x] Gate, behavioural commits and M9 handoff; push final delivery and stop.

## M10 — UX polish, audit inputs and gated clean signup

Builder brief: [docs/briefs/M10.md](briefs/M10.md). M9 approved by Claude per builder.
- [x] Preserve the entire builder brief in its own commit.
- [x] Spendable positive-value wallet notes, totals, collapsed History with receipts/zero-value labels, cash-out only on spendable notes.
- [x] Automatic estimated transaction windows for every EVM action, one confirmation, advanced manual panel, existing signing/journal/unknown-outcome invariants retained.
- [x] Account/nav copy, 390px axe and T-NOPLAIN-WEB checks; before/after screenshots and secret scan.
- [x] Flatten Books v2 and BlobBoard, compile each alone with solc 0.8.24, commit/address/hash headers and audit process document with empty findings table.
- [x] Prepare `pnpm evidence --m10-fresh-signup`; do not start before builder faucet-ready signal after 09:40 Lagos on 24 Nov.
- [x] Run uninterrupted deployed empty-profile create/backup/manual faucet/activate/deposit 2/pay 0.5/supplier1 receive; stop on faucet refusal, no deployer funding.
- [x] Only after success, update C5/C11 and JUDGES with measured fresh-run time/cost; retain M9 resumed evidence.
- [x] Gate, separate behavioural commits, handoff, push and stop.

## M10b — Window confirmation, wallet cleanup and fresh-signup checkpoint

Builder brief: [docs/briefs/M10b.md](briefs/M10b.md). M10 approved with fixes per builder.
- [x] Preserve the full builder brief in its own commit.
- [x] Accessible in-app window modal; correctly pluralised estimate; WINDOW_DECLINED cancellation and real WINDOW_CLOSED recovery remain distinct.
- [x] Human proof progress, balance metadata under Details, collapsed manual window with empty fields, newest-ten History and clear zero-value labels.
- [x] S-WINDOW-REOPEN observes replacement on the demo business account and confirms an EVM spend from the new budget using existing journals.
- [x] Audit documentation explains normalized header hashes and points to evidence/m10-audit.json (already present in M10).
- [x] Gate, Wallet/modal/cancellation/History screenshots at 390/1440, axe and known-secret scan pass.
- [x] Push and verify the deployed JavaScript contains the new modal string; stop for the builder's fresh-signup go-ahead.
- [x] Only after a new go-ahead in this session: uninterrupted deployed M10 signup with manual faucet, no alternative funding; update C5/C11/JUDGES only after success.

M10b fresh attempt, 25 Nov 2026: builder go-ahead received; `pnpm evidence --m10-fresh-signup` created/downloaded the backup, then FAILED at WAIT_FOR_MANUAL_FAUCET after the 20-minute funding timeout. No activation or payment was reached. Failure evidence: `evidence/m10-fresh-signup-attempt-1795595160341.json`; session/evidence retained, no resume or alternative funding. C5/C11 and JUDGES were unchanged at that checkpoint.

Builder retry amendment: [docs/briefs/M10b-retry.md](briefs/M10b-retry.md). Push the failed record `0896ff0`; extend the next attempt's manual funding wait to 60 minutes with a prominent address and two-minute reminders; preserve separate account/session/report/screenshot identity; validate, commit and push before starting the authorized new deployed attempt.

The separately authorized retry `m10-1795594340224-d0023e20cd51bf67` PASSED uninterrupted on the deployed site. The same payer context detected manual funding, activated, deposited 2 QOR and privately sent 0.5 QOR; supplier1 checked the exact commitment in another context. Activation: 63.851 seconds / 0.319120916 QOR; total observed fees: 0.818424821 QOR excluding deposit principal. Receipt rereads, all 58 M10 image secret checks, the full gate (80 TypeScript / 13 distinct Forge tests) and production build passed. C5/C11 and JUDGES now include this scoped result; M9 resumed evidence and the earlier FAILED M10 attempt remain intact. Final delivery ends at the M10b handoff.

## M11 — Audit triage, unchanged stage 2 sources and verified PQ settings

Builder brief: [docs/briefs/M11.md](briefs/M11.md). No contract behavior changes or redeployment authorized.
- [x] Preserve the entire builder message in its own commit and pull the builder's uploaded Books PDF.
- [x] Triage all five Books stage 1 findings with regression tests; retain the exported PDF and later report placeholders.
- [x] Correct audit scope wording without a vendor audit-status claim.
- [x] Add NatSpec only, retain stage 1 files, independently compile stage 2 sources and prove unchanged runtime against both deployments; gate rejects divergence.
- [x] Document observed deployment, BN254, BlobBoard receipts and M10 uninterrupted timing/fees; retain earlier attempts and links.
- [x] Inspect resolved crypto dependencies, record modes/randomness/contexts/final-standard implementation selection, close calldata and measured whole-transaction gas with scoped claims.
- [x] Clear stale proof progress on cancellation; verify at 390px without broadcasts.
- [x] Full gate including claims and production build pass on `6b19949`; separate commits and M11 handoff prepared. Final delivery is the handoff commit push after a second pull, then stop.

## M12 — Hedged application signatures and complete axe rules

Builder brief: [docs/briefs/M12.md](briefs/M12.md). M11 approved by Claude, as reported by the builder. No contract source changes, deployments, vendor changes or secrets.

- [x] Preserve the entire builder message in a separate brief commit.
- [x] Hedge our QoreSign records and Books close signatures with the existing digest, key, empty context and wire format; leave library-internal signatures unchanged.
- [x] Verify repeated hedged signatures differ and both verify; retain deterministic record and judge-book verification.
- [x] Prove hedged close acceptance in a Books contract regression and pinned live pqcVerify/Books calls, then close a fresh test book and retain the receipt.
- [x] Update PQ parameters and C12 with scoped evidence and library-default reasons.
- [x] Place all visible content inside landmarks and run unfiltered axe on all nine requested pages at 390/1440; record every remaining finding with its reason.
- [x] Run gate and production build on `2349f03`, scan changed files for known secrets and prepare the M12 handoff.

Final delivery after committing the handoff: push, wait for that commit’s live Vercel deployment, verify the deployed JavaScript and stop. The subsequent push/deployment result is reported in the final chat response because this record precedes its own commit and push.

## M13 — Four-report audit closure and submission checks

Builder brief: [M13](briefs/M13.md). No contract source changes, redeployment, vendor changes or secrets.
- [x] Save the entire builder message in a separate commit and pull first.
- [x] Record all four PDFs, scores, unscored PQ status and finding/test mapping; disclose historical-log availability.
- [x] Add truncated/empty signature Forge regression and pinned live precompile evidence.
- [x] Replace recording script and verify labels against deployed UI/bundles.
- [ ] Claims, README/JUDGES links and deployed routes checked; gate passes.
- [ ] Fresh temporary clone of pushed repository: frozen install, gate and web build captured.
- [ ] Handoff with project-page values written; pull before final push, push and stop.
