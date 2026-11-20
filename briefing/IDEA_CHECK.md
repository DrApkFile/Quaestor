# IDEA_CHECK — Quaestor

Date: 2026-11-20. Category: **Encrypted Apps**. Solo. Normal web app (no PWA, no native app).

## Hook
**"Private to the world. Open to your auditor. One quarter at a time."**
Pay and get paid privately on QoreChain. Every payment writes a book entry sealed with post-quantum encryption. Grant your auditor one quarter; they read exactly that quarter and can check every entry against the chain.

## Who, the job, how they cope today, where it fails
- **Who:** a small company, agency or freelancer paid in stablecoins; and their accountant or auditor.
- **Today:** pays on a public chain (every client, supplier and amount visible forever) and keeps the real details (who, why, invoice, tax category) in a spreadsheet or SaaS ledger, emailed in plaintext at audit time. All or nothing.
- **Where it fails:** competitors read your supplier list and prices on chain; the auditor gets every year when they need one quarter; records must be kept 7–10 years, past 2035 when NIST disallows today's classical key exchange (NIST IR 8547 final, 27 Oct 2026), so harvested ciphertext is a real risk.

## The private rail (non-negotiable)
Money moves through **our own deployment of Gloam's open-source shielded pool (MIT) on QoreChain testnet**, driven by `@gloamtrade/sdk`. Amounts and counterparties of payments are hidden. Payment tickets are sealed with ML-KEM-1024 to the payee's registered QoreChain key (replacing Gloam's P-256 tickets). See knowledge/gloam.md. If the deployment spike fails (S03–S06), we escalate to QoreChain on day 2, not drop the rail.

## Hard core
1. **Sealed books with quarter keys.** Each quarter has its own random 32-byte key. Entries (counterparty, purpose, invoice file, category, notes, payment reference) are encrypted under it and signed ML-DSA-87. The quarter key is sealed (QoreSeal hybrid) to the business's registered key and, on grant, to the auditor's registered key. Grant records are signed and anchored on chain. Q3 grant opens Q3 only.
2. **Verdict engine (pure code)** — for each entry, exactly one of:
   - `MATCHED`: a Gloam receipt proof shows the entry's payment commitment is a real leaf in the pool with that amount, bound to this book, quarter and entry.
   - `UNBACKED`: no valid receipt, wrong amount, wrong context, or commitment not in the tree.
   - `TAMPERED`: entry bytes don't hash to the anchored commitment, or the ML-DSA signature fails.
   - `UNKNOWN`: data unavailable. Never shown as a pass.
3. **Quarter reconciliation** — `opening + receipts in − payments out = closing`, with the closing balance proven exactly on one consolidated note. A hidden payment out of booked funds makes it fail (`DOES_NOT_ADD_UP`). Design settled on day 4 (DECISIONS D5); candidate proofs: receipt per entry, payroll_total for outflows, exact balance at close.

## Thin-wrapper test
No model call. Remove QoreSeal → no books, no grants. Remove the pool → no private payments, no receipts. Remove the chain → no key registry, no anchors, no tree to check against.

## Sponsor deletion test
| Piece | Removed → what breaks | Critical? |
|---|---|---|
| QoreChain KEM registry | can't find the payee's or auditor's key from an address | yes |
| ML-DSA-87 keys + pqcKeyStatus/pqcVerify | entries and grants can't be bound to the account; Books contract can't verify close records | yes |
| QoreSeal | no tickets, no quarter-key sealing | yes |
| QoreSign | can't sign entries, grants, cards; can't register keys | yes |
| Gloam pool on Diana (our deploy) | no private rail, no receipts | yes |
| QoreChain EVM (Books contract) | no anchors, no grant log | yes |

## Boundary
Chain + proofs decide what's real. Pure code decides verdicts. Our server only stores ciphertext and never holds a business, payee or auditor secret. No AI in the product (AI builds it; AI_USAGE.md for the award).

## The loop
Business and auditor register keys → client pays the business privately (ticket sealed to the business) → business pays two suppliers privately (tickets sealed to them) → each payment writes a sealed, signed book entry anchored on chain → quarter closes with a reconciliation record → business grants Q3 to the auditor → auditor opens Q3, sees every entry `MATCHED`, quarter adds up → auditor is refused on Q2 → we tamper one entry (`TAMPERED`) and book one invented payment (`UNBACKED`) → anyone sees on the public page that the books are anchored, with nothing readable.
The step others skip: **checking the books against the chain without exposing the chain's other users**, and **scoped, per-quarter access**.

## What we deliberately do not claim
- The pool itself is not post-quantum (Groth16/BN254 soundness). We claim PQ confidentiality of tickets and books.
- Deposits and cash-outs are public at the pool's edge.
- Income kept off the books by collusion (payer hands the note secret over out of band, business never books it, never consolidates it) is not detected.
- A granted auditor can copy what they read. Granting can't be undone for that quarter.
- Testnet only; not affiliated with Gloam; no external review.

## Requirements → proof map
| Requirement | Quaestor | Proof a judge can open |
|---|---|---|
| ML-KEM-1024 encryption | tickets, quarter keys and invoice files sealed with QoreSeal hybrid | tests T-SEAL-*, memo-board txs, store blobs |
| Registered recipient keys | business, payees and auditor publish keys via MsgRegisterKEMKey; app seals only to registry keys | registration txs, T-REG-* |
| ML-DSA key binding | recipient cards checked against both on-chain keys; entries/grants ML-DSA signed; Books contract checks close records with pqcVerify + possessionProven | T-BIND-*, contract txs |
| Client-side enc/dec | sealing and opening only in the browser; server receives only QoreSeal bytes | T-NOPLAIN-* (Playwright request interception) |

## Verdict
**Go.** Biggest risk is the private rail on Diana (precompiles, logs, windows): spikes on day 2, escalation path ready.
