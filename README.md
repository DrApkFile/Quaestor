# Quaestor

**Keep your books private for decades, and open them to your auditor one quarter at a time.**

Quaestor is a web app for private business payments on QoreChain testnet. Payments move through our own deployment of Gloam's open-source shielded pool; every payment writes a book entry sealed with post-quantum encryption (ML-KEM-1024) and signed with ML-DSA-87; the business grants its auditor one quarter, and the auditor checks each entry against the chain.

Built for **Build Before Q-Day**, the QoreChain Developer Fest · category **Encrypted Apps** · testnet `qorechain-diana` only.

## Status (20 Nov 2026)
Planning done; building starts. **Nothing below is claimed as working until it is marked PROVEN in [CLAIMS.md](CLAIMS.md).**

| What | Status |
|---|---|
| Gloam SDK proof for chain 9800 (offline) | proven offline — spikes/s02-output.txt |
| Pool deployed on QoreChain testnet | not yet (milestone M0) |
| Post-quantum payment tickets | not yet (M2) |
| Sealed books, grants, verdicts | not yet (M3–M4) |
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
