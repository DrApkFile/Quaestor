# Plan: Fri 20 Nov – Wed 2 Dec (solo)

Hard stop: **2 Dec 20:00 UTC**. Record each demo act the day it works.

| Day | Date | Goal | Done when |
|---|---|---|---|
| 1 | Fri 20 Nov | Ask organisers the 5 open questions (EVENT.md, esp. Q5 on using Gloam's MIT code). Read Veil's README fully. Create repo (Apache-2.0 or MIT), install the Build GitHub App, create the project page (Encrypted Apps, AI-native ticked). Faucet for deployer, business, client, 2 suppliers, auditor | repo public, page exists, questions posted |
| 2 | Sat 21 Nov | **Private-rail spikes** S03–S07 on your machine: BN254 precompiles, deploy PoseidonT3 + verifiers + pool + memo board on Diana, one shield → send → unshield round trip, log sync | pool live on Diana, round trip tx hashes in evidence/ — or escalation posted to QoreChain |
| 3 | Sun 22 Nov | Spikes S08–S12 (CORS, pqc precompiles, key registration, memo size, faucet). `packages/chain` pool wrapper over the SDK | private send from code, ticket on memo board |
| 4 | Mon 23 Nov | `packages/core`: ticket codec (QoreSeal), entry codec, period keys, grants. **Decide D5 reconciliation** with a ceiling test | T-SEAL-*, T-TICKET-* green; D5 written |
| 5 | Tue 24 Nov | `packages/core` verdict engine (all verdicts, old-root check) + tests from real receipt proofs | T-VERDICT-* green |
| 6 | Wed 25 Nov | `contracts/Books.sol` + Foundry tests; deploy on Diana; `apps/store` | anchors land on Diana |
| 7 | Thu 26 Nov | End-to-end crude: pay privately → ticket → entry sealed, signed, anchored, all scripted | **first evidence run** |
| 8 | Fri 27 Nov | `apps/web` accounts + backup + key registration + Pay screen | **record act 1** |
| 9 | Sat 28 Nov | `apps/web` Business books + grant; Auditor open + verdicts | **record acts 2–5** |
| 10 | Sun 29 Nov | Attack-lab book; public check page; reconciliation UI if D5 proven; `pnpm evidence`; **QCAI audit stage 1 on Books.sol** | **record acts 6–7** |
| 11 | Mon 30 Nov | Fix audit findings → **QCAI stage 2**, docs/AUDIT.md; README (requirements-with-evidence table), CLAIMS.md, THREAT_MODEL.md, DECISIONS.md, AI_USAGE.md, JUDGES.md, NOTICE (Gloam credit), cover | claims check passes |
| 12 | Tue 1 Dec | Video ≤ 3:00; deploy web (Vercel) with self-hosted circuits; project page; kits "Check again" | video live |
| 13 | Wed 2 Dec | Clean-clone pre-submit audit; blockers only; final push by 20:00 UTC; post on X #BuildBeforeQDay | done |

## Every day
Add today's entry to docs/ai-log/ (5 minutes): what the AI generated, what you decided or changed, what was verified and how.

## Cut list (cut from the top first)
1. Audit CLI as a package (keep a script).
2. Invoice file attachments (keep text fields).
3. Reconciliation `ADDS_UP` (ship entry verdicts; mark NOT PROVEN).
4. QoreX funding (in-app accounts funded from the faucet).
**Never cut:** the private rail on Diana, PQ tickets, period grant + refusal, entry verdicts with the attack lab, the no-plaintext test, the README evidence table.

## If the private rail is blocked on day 2
Same day: post the exact failing call and output in QoreChain's Discord developer channel and ask for the precompile / limit status. Keep building `packages/core` and Books.sol (they don't depend on the pool). Decide by end of day 4 with whatever QoreChain answered; record it in DECISIONS.md.
