# AI_USAGE

How AI was used to build Quaestor, what it generated, and what the human builder decided and did. Kept as the work happened; the daily record is in [docs/ai-log/](docs/ai-log/). Nothing here is written after the fact from memory.

## Tools
| Tool | Used for |
|---|---|
| Claude (Anthropic) — planner and reviewer | research on the fest, QoreChain kits and Gloam's code; offline spikes; the briefing pack (PRD, plan, threat and failure analysis); the scaffold and M0 scripts; a review of every milestone handoff (`docs/reviews/`) |
| Codex (OpenAI) — coding agent | builds milestones M1–M7 under `AGENTS.md`, ending each with a handoff in `docs/handoff/` |
| QCAI smart contract auditor (QoreChain) | two-stage audit of `contracts/Books.sol` (docs/audit/, docs/AUDIT.md) |

## Workflow
1. **Research before code.** The agent read the fest rules and every Encrypted Apps entry, then primary sources (QoreSeal, QoreSign, QoreChain core docs, QoreX types, Gloam's contracts and SDK) and wrote notes to `briefing/knowledge/`.
2. **Ideas proposed, human chose.** The agent proposed ideas; the builder rejected several and set the constraints (Encrypted Apps only, not region-specific, a payment app, a normal web app, Gloam's open-source pool as a mandatory private rail, no claims on Gloam's behalf).
3. **Spikes before building.** Claims from docs were tested offline first (`spikes/`), and live testnet checks run by the builder on their own machine.
4. **A contract for the coding agent.** `AGENTS.md` and `briefing/BUILD_CONTRACT.md` fix the invariants, honesty rules and the code bar Codex must follow; `pnpm gate` enforces them.
5. **Two agents, one human in between.** Codex finishes a milestone and writes a handoff with real command output → the builder sends it to Claude → Claude reviews it against the PRD and the code bar and writes must-fix / should-fix notes → the builder decides what goes back to Codex. Neither agent's output is accepted without the other's check and the builder's decision.
6. **Human review on the critical path.** Every change to the verdict engine, ticket sealing, Books.sol and the pool wrapper is reviewed by the builder before merge.
7. **AI security review.** QCAI stage 1 → fixes → stage 2, findings mapped to commits.

## Generated work vs. human contribution
Filled in as the build goes. One row per meaningful piece of work.

| Area | AI generated | Human decided / changed / verified | Evidence |
|---|---|---|---|
| Idea and scope | 4 rounds of idea proposals; stakeholder research | chose Quaestor; made the private rail mandatory; dropped region focus; chose a normal web app; set the "not affiliated with Gloam" wording | docs/ai-log/2026-11-20.md |
| Briefing pack | EVENT, LANDSCAPE, IDEA_CHECK, PRD, spikes, plan | reviewed the pitch; answered organiser questions; added prize targets | briefing/ |
| — | — | — | — |

## What the AI got wrong, and how it was caught
Kept honestly; an empty table here would not be believable.

| Date | What went wrong | How it was caught | Fix |
|---|---|---|---|
| 2026-11-20 | first idea (a paid members channel) didn't fit what the builder wanted | builder rejected it | re-scoped around payments + Gloam |
| 2026-11-20 | Gloam SDK proof spike hung for 10 minutes | process at 0% CPU | snarkjs `singleThread: true`; recorded in REALITY_SPIKES S02 |

## Limits
AI output is never treated as verified until a test, spike or chain transaction confirms it. Claims in the README come only from CLAIMS.md entries marked PROVEN.
