# DECISIONS

Format: context, decision, rejected alternatives, consequence, where.

## D1 In-app accounts
Context: QoreX has no decrypt/KEM API and refuses `signArbitrary`, so it can't sign a recipient card. Decision: every user gets an in-app QoreChain account from a browser mnemonic, with mandatory backup. Rejected: deriving keys from a wallet signature (breaks the PQ claim). Where: apps/web, packages/chain.

## D2 Private rail is P0
Decision: our own deployment of Gloam's MIT pool on Diana, driven by @gloamtrade/sdk with explicit chainId 9800 and our poolAddress. Organisers confirmed on 2026-11-20 that deploying it ourselves with credit is allowed. Rejected: public transfers as the main rail. Where: contracts/vendor/gloam, packages/chain.

## D3 QoreSeal hybrid only; no P-256 tickets
## D4 Seal keys never derived from a wallet signature
## D5 Reconciliation design — OPEN until M4 (see PRD §9). UI never shows ADDS_UP before this is marked proven.
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
