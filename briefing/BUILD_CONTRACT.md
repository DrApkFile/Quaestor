# BUILD_CONTRACT — Quaestor

## Frozen decisions (change only with a DECISIONS.md entry)
- D1: every user gets an in-app QoreChain account (browser mnemonic, mandatory backup). QoreX optional for funding only.
- D2: **the private rail is P0.** Our own deployment of Gloam's MIT pool on Diana, driven by `@gloamtrade/sdk` with explicit `chainId: 9800` and our `poolAddress`. If a spike fails, escalate to QoreChain the same day; do not quietly switch to public transfers.
- D3: QoreSeal hybrid (ML-KEM-1024 + X25519) for tickets, period keys, entries' invoice files. `mlkem` mode never used silently. **No P-256 / ECDH ticket path anywhere in our code.**
- D4: seal keys never derived from a wallet signature.
- D5 (open until day 4): reconciliation design. Until proven, the UI never shows `ADDS_UP`.
- D6: Gloam contracts vendored at a pinned commit and unmodified; our changes live in our own deploy script and wrapper. Credited in README and NOTICE.
- D7: pins — @qorechain/qoreseal 0.1.0, @qorechain/qoresign 0.2.0, @qorechain/sdk 0.14.0, @qorechain/evm 0.14.0, @qorechain/pqc 0.2.3, @gloamtrade/sdk 0.8.0, snarkjs (pin the version installed on day 2). Exact versions, frozen lockfile.
- D8: no Gloam hosted service is called (relay, partner API, hosted MCP, gloam.trade URLs). Circuit artifacts are self-hosted.

## Never fabricate
- Show `—` until a real value exists. No sample hashes, balances or counts presented as real.
- A failed read is `UNKNOWN`, never `MATCHED` or `ADDS_UP`.
- Demo accounts, the demo book and the attack-lab book are labelled "demo" in UI, README and video.
- Never say "payments through Gloam". Say "through our deployment of Gloam's open-source pool on QoreChain testnet".

## No silent fallback
No `|| default` on values that matter; zod-validated config at startup. No empty `catch`; every error maps to a closed code or is rethrown.

## Traceable numbers
Every number in README/evidence records: command, commit, block or tx hash, date, real/simulated.

## Failures stay on record
Failed spikes and runs stay in evidence/ with dates. Claims that don't replicate are demoted in CLAIMS.md, not deleted.

## Protected critical path
packages/core/{verdict,entry,period,ticket}.ts, contracts/Books.sol, the pool wrapper, apps/web pay and auditor-open paths.

## Gate
`pnpm gate` from a clean clone: frozen install, typecheck, lint (no comments, no `any`), unit + property tests, `forge test`, claims check, secret scan, "no P-256 ticket path" check (grep for `ECDH`/`P-256` in our packages fails the gate).

## Proof priority
1. Private payment round trip on Diana with an ML-KEM-sealed ticket opened by the payee.
2. Auditor opens the granted period, every entry `MATCHED`; refused on the other period.
3. Attack lab: `TAMPERED`, `UNBACKED` (invented), `UNBACKED` (reused receipt).
4. No plaintext or secret key leaves the browser.
5. Reconciliation `ADDS_UP` vs `DOES_NOT_ADD_UP` (only if D5 is proven).
