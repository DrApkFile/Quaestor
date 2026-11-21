# DECISIONS

Format: context, decision, rejected alternatives, consequence, where.

## D1 In-app accounts
Context: QoreX has no decrypt/KEM API and refuses `signArbitrary`, so it can't sign a recipient card. Decision: every user gets an in-app QoreChain account from a browser mnemonic, with mandatory backup. Rejected: deriving keys from a wallet signature (breaks the PQ claim). Where: apps/web, packages/chain.

## D2 Private rail is P0
Decision: our own deployment of Gloam's MIT pool on Diana, driven by @gloamtrade/sdk with explicit chainId 9800 and our poolAddress. Organisers confirmed on 2026-11-20 that deploying it ourselves with credit is allowed. Rejected: public transfers as the main rail. Where: contracts/vendor/gloam, packages/chain.

## D3 QoreSeal hybrid only; no P-256 tickets
## D4 Seal keys never derived from a wallet signature
## D5 Scoped holdings coverage — decided by Claude, authorized by builder for M4
Context: completeness of income and spending cannot be established from a business's voluntarily disclosed payments. Decision: signed opening balances are anchored at book registration; closing balances are previous close/opening + IN - OUT - cash-out fees per asset. A funds proof supports a lower bound with threshold equal to closing balance, bound to quaestor|holdings|book|period, using at most four distinct notes (consolidate to self if necessary). Every nonzero revealed nullifier must be unspent at the actual close block; the root must be in the pool's full insertion history at that block. Proof verification and all reads are pinned to that block.
Verdicts are HOLDINGS_COVER_BOOKS, HOLDINGS_SHORT, UNKNOWN. A valid lower-threshold proof is SHORT relative to the declared books; it does not prove an upper bound on all holdings. Missing/invalid proof, unavailable data or spent backing produces UNKNOWN. A failed construction due to insufficient selected notes is recorded as such, not fabricated into a valid proof or proof of global insolvency. Never display adds up. C6: the business holds at least the balance its books imply; does not detect income kept off the books or payments made from unbooked funds. This replaces the old complete-reconciliation proposal in PRD §9. Where: core holdings, Books v2 opening/close, M4 auditor and evidence.
## D6 Gloam vendored unmodified at d8db1e6; our changes live in our deploy script and wrapper
## D7 Exact version pins (AGENTS.md "Versions")
## D8 No Gloam hosted service; circuit files self-hosted
## D9 snarkjs and circomlibjs are GPL-3.0
Context: Gloam's proving stack uses snarkjs (GPL-3.0); PoseidonT3 bytecode comes from circomlibjs (GPL-3.0). Decision: our own code stays MIT; these are dependencies, credited in NOTICE. The web bundle includes snarkjs, so the deployed bundle carries its GPL terms. Revisit only if a licence question is raised.
## D10 Demo uses 1-day "demo-scale periods"; production default is calendar quarters (PRD §5)

## D11 Anonymous hybrid tickets and period-key envelopes
Context: public nonzero recipient hints permit anyone with registry public keys to identify recipients. Claude's original M2 brief incorrectly prohibited anonymous envelopes. Decision: hybrid envelopes must be anonymous. Scan decryption refusal is an expected non-recipient result. The payer's EVM address still originates private sends and memo posts; no payer anonymity is claimed without a relay. Where: M2 review/erratum, tickets, period grants.

## D3 implementation note — close verification
S09/S16 at block 10434078 confirm both precompiles active. Books uses registered algorithm-1 possession-proven keys and raw ML-DSA-87 verification (empty context, no prehash). The PRD fallback is not selected.

## D12 M3 deterministic encodings
SDK proofContext accepts an object, not the PRD's shorthand string. Use kind payment, chainId 9800, our pool, verifier quaestor|book|period|index, expiresAt 0 as a deterministic context tag; no expiry claim or clock read. Contract period bytes32 is keccak256(UTF-8 UTC YYYY-MM-DD). Epoch ordinals start at 1; entry indices start at 0. Close records in M3 omit reconciliation fields pending D5. Demo period dates are book labels, not assertions that all payment transactions occurred on those dates.

## D13 Books v2 close binding
Close entryCount is uint64, matching nextIndex. The signed packed domain appends uint64 entryCount and bytes32 lastEntrySha3 before closeSha3. Registration requires a nonzero opening-record SHA3, emits OpeningAnchored, and stores it. The record also has a hybrid QoreSign signature checked by the auditor. v1 remains historical in M3 evidence; v2 has a new deployment. Closing balances and holdings proofs are encrypted to the period key with the signed close record; only its SHA3/count/last hash are public at close. Opening balances are signed locally and anchored by hash, not published as plaintext evidence.

## D14 Chain storage and Vercel — builder decision for M5
BlobBoard is an ownerless permissionless event-only content board. It replaces apps/store; there is no application data server. Vite/React is hosted on Vercel; a tightly allowlisted stateless pass-through is permitted only for browser CORS failures measured in S08. It forwards public queries and already-signed transactions, never keys, and logs no bodies. Readers distrust event SHA3 fields, rehash bytes, and validate their Books anchors and signatures. All new opening/close anchors use ciphertext SHA3 (D15). No payment commitment uniqueness is put on chain because that would publicly link a book to a payment.

## D15 Ciphertext anchors and disclosed legacy demo balances — builder clarification
From M5 onward, opening and close records anchor SHA3-256(ciphertext), just like entries; the raw ML-DSA close signature covers that ciphertext hash. Books v2 already accepts opaque hashes, so no contract change is needed.
M4's immutable opening/close anchors instead hash their plaintext records. Only those historical demo books may use public owner-hybrid-signed mappings {book,kind,anchoredSha3,ciphertextSha3}, posted as kind keccak256("quaestor:legacy-map"). The reader verifies the on-chain book owner's hybrid signature, hashes fetched ciphertext, decrypts locally, and requires its plaintext record hash to equal the original anchor. No mapping is used for a new record. A false plaintext link or non-owner signature is TAMPERED.
Public hashes of guessable plaintext can be brute-forced. M4 opening records have public book IDs, a timestamp near registration, and small demo balances: treat those opening balances as disclosed demo data. M4 close records include proof bytes and are not similarly guessable, but all future records still anchor ciphertext. Where: THREAT_MODEL, core record codecs, BlobBoard compatibility reader.
