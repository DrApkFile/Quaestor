# Quaestor

**Keep your books private for decades, and open them to your auditor one quarter at a time.**

Quaestor is a normal web app for private business payments on QoreChain testnet. The browser moves payments through our own deployment of Gloam's open-source shielded pool, seals demo book entries with period keys, signs them with ML-DSA-87, and grants an auditor access to one demo-scale period.

Built for **Build Before Q-Day**, the QoreChain Developer Fest · category **Encrypted Apps** · testnet `qorechain-diana` only.

## Status (22 Nov 2026)
Milestones M0–M7 have scoped testnet evidence. Northwind Studio (demo) receives 1 QOR and pays suppliers 0.5 and 0.25 QOR in daily period A; period B has one incoming and one outgoing payment. Both close and are granted: all five entries are MATCHED and both periods are HOLDINGS_COVER_BOOKS. Populated C stays open and NOT_GRANTED. A B-only auditor also succeeds, and an encrypted account-plus-journal backup restores the same private balance in an empty browser context. See [M7 evidence](evidence/m7-browser-initial.json), the [judge path](JUDGES.md) and [CLAIMS.md](CLAIMS.md) for scope and limits.

| What | Status |
|---|---|
| Gloam SDK proof for chain 9800 (offline) | proven offline — spikes/s02-output.txt |
| Our deployment of Gloam’s open-source pool | proven live — [M0 evidence](evidence/m0-deploy.json) |
| Anonymous hybrid payment tickets | proven live — [C1 evidence](evidence/m2b-ticket-anonymous.json) |
| Sealed books and one-period auditor access | proven in scripts — [C2 evidence](evidence/m3-books.json) |
| Receipt verdicts for all granted A entries | proven in scripts — [C3/attack evidence](evidence/m4-verdicts.json) |
| Holdings coverage at close | proven lower-bound check — [C6 evidence](evidence/m4-verdicts.json); complete reconciliation is not provided |
| Chain storage and read-only auditor | proven for the M4 demo — [chain-only evidence](evidence/m5-blobs.json), [browser check](evidence/m5-web.json) |
| Browser payment, booking and scoped A/B audit | proven for the daily M7 demo — [browser evidence](evidence/m7-browser-initial.json), [screenshots](evidence/m7-screens/), scoped C5 |
| Encrypted journal backup and B-only audit | proven for the exercised M7 browser flow — [backup](evidence/m7-browser.json), [fresh auditors](evidence/m7-fresh-auditors.json), C6/D17 limits apply |
| Live read-only attack lab | proven for four scoped demo cases — [browser evidence](evidence/m7-attack-browser.json), [fresh-receipt duplicate](evidence/m7-duplicate.json), C4 limits apply |

## Repository map
| Path | What |
|---|---|
| briefing/ | research, PRD, plan, spikes, failure modes — start at briefing/README.md |
| docs/MILESTONES.md | the build in milestones, each with a done-when list |
| docs/handoff/, docs/reviews/ | coding-agent handoffs and review notes per milestone |
| contracts/ | Gloam's contracts (vendored, unmodified) + our deploy script + Books.sol (M3) |
| packages/, apps/ | core logic, chain access, web app; audit CLI remains unbuilt |
| scripts/day2/ | M0 runbook: accounts, BN254 check, deploy, verifier check |
| AI_USAGE.md, docs/ai-log/ | how AI was used, with the human's decisions |

**The pool’s Groth16/BN254 proofs are not post-quantum.** Books v2 is deployed at `0x9775c1d0dc814e41fb1b38d26fa17f60d24faf64`; the [deployment evidence](evidence/m4-books-v2.json) preserves the historical v1 address.

See the [threat model](THREAT_MODEL.md) for confidentiality boundaries and public metadata.

## Run the web app

Use Node 22+ and `pnpm install --frozen-lockfile`. Circuit artifacts are self-hosted by `./scripts/vendor-gloam.sh`; they are loaded lazily and cached in the browser. Run `pnpm -C apps/web dev`, or `pnpm -C apps/web build` for production. Vercel settings are in `vercel.json`; `.vercelignore` excludes local accounts and keys.

Public check needs no account. Auditor imports an encrypted backup and opens granted records using on-chain blobs. The [judge path](JUDGES.md) provides the intentionally public encrypted testnet-only demo-auditor backup and passphrase. M4 opening balances must be treated as disclosed demo data; public plaintext hashes were guessable. New records anchor ciphertext hashes (D15).

`pnpm evidence --m5-web` creates a private encrypted fixture from the local demo auditor, then runs Playwright against a production preview with the deployment CSP. It requires local `.accounts/auditor.json`; the fixture and passphrase are never committed or uploaded. `pnpm gate` runs the reproducible unit/Foundry checks separately.

`pnpm evidence --m6` uses local, git-ignored encrypted demo vaults and separate browser contexts/journals. It preserves completed operations across retries, checks plaintext canaries and keys in traffic, and writes the live receipts and 390px/desktop screenshots. See [the M6 brief](docs/briefs/M6.md) and [handoff](docs/handoff/M6.md).

The final demo book is `0x745c77ad45cf784d7a16e7ea12461f23ab9ea2d88a0f50bf6678262f76d6afc1`. A and B are 2026-11-22 and 2026-11-23; C is 2026-11-24. All are daily demo-scale periods; new books default to Quarterly. The historical M6 record remains in [its evidence](evidence/m6-browser.json).

`pnpm evidence --m7` resumes the local encrypted fixtures, checks the browser journey, prepares the separate duplicate fixture and runs read-only judge checks. `QUAESTOR_M7_RECHECK_BROWSER=1 pnpm evidence --m7` repeats the checkpointed browser checks and screenshots, preserving the original full-flow record. [Deployment instructions](docs/DEPLOY.md) cover the production relay and Vercel setup.

Not built or not established: an audit CLI, a hosted Vercel deployment, universal leak freedom or universal recovery from stale backups. fUSD/conversion, cash-out and quarterly controls remain outside the live privacy claim. Unknown-outcome holding is unit tested; no live broadcast-uncertainty fault injection is claimed. Later-period opening balances are declared and signed by the business; their correctness is not established (D17).

Closing selects up to four covering notes per asset, largest first. The pinned pool cannot merge notes; otherwise the app refuses with CONSOLIDATION_UNSUPPORTED (D16).

## Credits
- **Gloam** — shielded pool contracts, circuits, final ceremony keys and SDK, MIT licence. We deploy our own instance on QoreChain testnet. **Not affiliated with Gloam.** See [NOTICE](NOTICE).
- **QoreChain Association** — QoreSeal, QoreSign, QoreChain SDK, `@qorechain/evm`, `@qorechain/pqc`, create-qorechain-dapp (Apache-2.0).

- **Inter Tight** — SIL OFL 1.1; **Lucide** — ISC with Feather MIT notices. Redistribution licences are retained in apps/web/public/.

## Licence
MIT — see [LICENSE](LICENSE).

UI style adapted from the builder's earlier project Muuve. See [the source-cited style study](docs/design/muuve-style.md) and the retained font/icon licences in apps/web/public/.
