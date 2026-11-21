# Quaestor

**Keep your books private for decades, and open them to your auditor one quarter at a time.**

Quaestor is building a normal web app for private business payments on QoreChain testnet. The script prototype moves payments through our own deployment of Gloam's open-source shielded pool, seals demo book entries with period keys, signs them with ML-DSA-87, and grants an auditor access to one demo-scale period.

Built for **Build Before Q-Day**, the QoreChain Developer Fest · category **Encrypted Apps** · testnet `qorechain-diana` only.

## Status (21 Nov 2026)
Script milestones M0–M3 have live evidence. Claims and their limits are recorded in [CLAIMS.md](CLAIMS.md). Browser workflows remain unbuilt.

| What | Status |
|---|---|
| Gloam SDK proof for chain 9800 (offline) | proven offline — spikes/s02-output.txt |
| Our deployment of Gloam’s open-source pool | proven live — [M0 evidence](evidence/m0-deploy.json) |
| Anonymous hybrid payment tickets | proven live — [C1 evidence](evidence/m2b-ticket-anonymous.json) |
| Sealed books and one-period auditor access | proven in scripts — [C2 evidence](evidence/m3-books.json) |
| Receipt verdicts and reconciliation | not built (M4); Groth16 proofs are not post-quantum |
| Web app | not yet (M6–M7) |

## Repository map
| Path | What |
|---|---|
| briefing/ | research, PRD, plan, spikes, failure modes — start at briefing/README.md |
| docs/MILESTONES.md | the build in milestones, each with a done-when list |
| docs/handoff/, docs/reviews/ | coding-agent handoffs and review notes per milestone |
| contracts/ | Gloam's contracts (vendored, unmodified) + our deploy script + Books.sol (M3) |
| packages/, apps/ | core logic, chain access, web app, store, audit CLI |
| scripts/day2/ | M0 runbook: accounts, BN254 check, deploy, verifier check |
| AI_USAGE.md, docs/ai-log/ | how AI was used, with the human's decisions |

## Credits
- **Gloam** — shielded pool contracts, circuits, final ceremony keys and SDK, MIT licence. We deploy our own instance on QoreChain testnet. **Not affiliated with Gloam.** See [NOTICE](NOTICE).
- **QoreChain Association** — QoreSeal, QoreSign, QoreChain SDK, `@qorechain/evm`, `@qorechain/pqc`, create-qorechain-dapp (Apache-2.0).

## Licence
MIT — see [LICENSE](LICENSE).
