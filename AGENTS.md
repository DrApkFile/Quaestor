# AGENTS.md — guide for the coding agent (Codex) on Quaestor

Read the relevant section of `briefing/PRD.md` before writing code. Do not derive requirements from memory.

## What this is
Quaestor: a normal web app (Vite + React, no PWA) where a business pays and gets paid privately on QoreChain testnet (qorechain-diana, EVM 9800) through **our own deployment of Gloam's open-source shielded pool (MIT)**, keeps books sealed with ML-KEM-1024 and signed with ML-DSA-87, and grants an auditor one period at a time. Fest: Build Before Q-Day, category Encrypted Apps. **Deadline 2 Dec 2026 23:59 UTC; internal 20:00 UTC. No commits after the deadline.**

## How we work (Codex builds, Claude reviews, the builder decides)
1. Work one milestone at a time from `docs/MILESTONES.md`. Read its brief in `docs/briefs/M<n>.md` (written by Claude) and its "done when" list before starting.
2. Commit small, behavioural commits as you go. Never squash or rewrite history.
3. When the milestone's "done when" list is met, write `docs/handoff/M<n>.md` from `docs/handoff/TEMPLATE.md`: what changed, exact commands run with their real output, commit hashes, what is not done, open questions. Never report a test or a tx hash you did not see.
4. Stop. The builder sends the handoff to Claude, who writes `docs/reviews/M<n>-review.md`. Fix every **must fix** before starting the next milestone.
5. If evidence contradicts the PRD, stop and write the conflict in the handoff; do not change the design on your own.

## Invariants the code cannot show
- `packages/core` does no network and reads no clock; chain data and time are arguments.
- Verdicts come from the closed sets in PRD §5. `UNKNOWN` is never green. Period verdicts are the scoped holdings results in DECISIONS D5; never show `ADDS_UP`.
- The verdict engine accepts a receipt root only if the pool tree (rebuilt from the pool’s insertion events (Shielded, Transferred)) actually had it. Never rely on `isKnownRoot` (last 100 roots only).
- Tickets are sealed only with QoreSeal hybrid to keys read from the QoreChain registry. There is no P-256/ECDH path. Gloam's `sealToReceiveTag`/`openSealedTicket` are never imported.
- No request carries plaintext entries, invoices, note secrets, mnemonics or secret keys. Playwright intercepts every request to prove it.
- Seal keys are never derived from a wallet signature.
- Every chain read for one decision is pinned to one block height.
- A spend whose broadcast outcome is unknown is held; a note is `SPENT` only after a receipt.
- We call no Gloam hosted service and load no artifact from gloam.trade.

## Versions (newer than your training data — read installed source)
- @qorechain/qoreseal 0.1.0, @qorechain/qoresign 0.2.0, @qorechain/sdk 0.14.0, @qorechain/evm 0.14.0, @qorechain/pqc 0.2.3, @gloamtrade/sdk 0.8.0, snarkjs (pinned day 2).
- Gloam SDK builders: always pass `chainId: 9800` **and** `poolAddress`. In Node pass `{ singleThread: true }` to snarkjs (workers hung in our spike).
- QoreChain EVM: every EVM tx needs a registered ML-DSA-87 key and an open EVM window. Open the window, then read the nonce, then sign. pqcVerify 0x0A01, pqcKeyStatus 0x0A02 (require `possessionProven`). No ML-KEM on EVM.
- Check `briefing/REALITY_SPIKES.md` before using an integration; don't build on a row that isn't `confirmed`.

## Honesty rules
From BUILD_CONTRACT.md. Never fabricate. Label demo data. Evidence only from `pnpm evidence`. README repeats only PROVEN claims from CLAIMS.md. Wording: "our deployment of Gloam's open-source pool", never "payments through Gloam". State plainly that the pool's Groth16 proofs are not post-quantum.

## Conventions
TypeScript strict, no `any`, zod at boundaries, external data parsed as `unknown`. No comments; names carry meaning. Files under ~180 lines. Discriminated unions for verdicts and states; closed error codes. Behaviour-named tests with acceptance IDs (`"A12 server never receives plaintext entries"`). Small behavioural commits, never rewritten. Check UI at 390 px wide. `pnpm gate` before every push.

## Scope
New ideas → ROADMAP.md. Anything not built is listed as not built.

## Reference
briefing/code-bar.md, briefing/pre-submit-audit.md, briefing/knowledge/{gloam,qoreseal,qorechain-evm-pqc}.md.
