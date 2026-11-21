# Quaestor

**Keep your books private for decades, and open them to your auditor one quarter at a time.**

Quaestor is building a normal web app for private business payments on QoreChain testnet. The script prototype moves payments through our own deployment of Gloam's open-source shielded pool, seals demo book entries with period keys, signs them with ML-DSA-87, and grants an auditor access to one demo-scale period.

Built for **Build Before Q-Day**, the QoreChain Developer Fest · category **Encrypted Apps** · testnet `qorechain-diana` only.

## Status (21 Nov 2026)
Script milestones M0–M4 have live evidence. Claims and their limits are recorded in [CLAIMS.md](CLAIMS.md). M5 adds chain storage and read-only browser foundations; see the scoped evidence below. Payment and book-writing screens remain M6.

| What | Status |
|---|---|
| Gloam SDK proof for chain 9800 (offline) | proven offline — spikes/s02-output.txt |
| Our deployment of Gloam’s open-source pool | proven live — [M0 evidence](evidence/m0-deploy.json) |
| Anonymous hybrid payment tickets | proven live — [C1 evidence](evidence/m2b-ticket-anonymous.json) |
| Sealed books and one-period auditor access | proven in scripts — [C2 evidence](evidence/m3-books.json) |
| Receipt verdicts for all granted A entries | proven in scripts — [C3/attack evidence](evidence/m4-verdicts.json) |
| Holdings coverage at close | proven lower-bound check — [C6 evidence](evidence/m4-verdicts.json); complete reconciliation is not provided |
| Chain storage and read-only auditor | proven for the M4 demo — [chain-only evidence](evidence/m5-blobs.json), [browser check](evidence/m5-web.json); Pay/book writing remain M6 |

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

## Run the web foundations

Use Node 22+ and `pnpm install --frozen-lockfile`. Circuit artifacts are self-hosted by `./scripts/vendor-gloam.sh`; they are loaded lazily and cached in the browser. Run `pnpm -C apps/web dev`, or `pnpm -C apps/web build` for production. Vercel settings are in `vercel.json`; `.vercelignore` excludes local accounts and keys.

Public check needs no account. Auditor imports an encrypted backup and opens the legacy M4 honest demo book using on-chain blobs. M4 opening balances must be treated as disclosed demo data; public plaintext hashes were guessable. New records anchor ciphertext hashes (D15).

`pnpm evidence --m5-web` creates a private encrypted fixture from the local demo auditor, then runs Playwright against a production preview with the deployment CSP. It requires local `.accounts/auditor.json`; the fixture and passphrase are never committed or uploaded. `pnpm gate` runs the reproducible unit/Foundry checks separately.

Pay, browser book writing, the full browser payment journey and a hosted Vercel deployment are not built in M5.

## Credits
- **Gloam** — shielded pool contracts, circuits, final ceremony keys and SDK, MIT licence. We deploy our own instance on QoreChain testnet. **Not affiliated with Gloam.** See [NOTICE](NOTICE).
- **QoreChain Association** — QoreSeal, QoreSign, QoreChain SDK, `@qorechain/evm`, `@qorechain/pqc`, create-qorechain-dapp (Apache-2.0).

## Licence
MIT — see [LICENSE](LICENSE).
