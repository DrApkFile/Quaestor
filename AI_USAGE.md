# AI usage

Claude planned and reviewed; Codex built and exercised the implementation; the builder chose the product, resolved design questions and relayed reviews. The contemporaneous record is in [docs/ai-log/](docs/ai-log/), [briefs](docs/briefs/) and [handoffs](docs/handoff/). Only M1 and M2 have separate committed review files; later approvals and required corrections are preserved in the builder's milestone briefs. We do not claim that an unavailable review artifact exists.

## The build and review loop

The builder required a normal web app, Encrypted Apps scope and our deployment of Gloam's open-source pool. Claude researched the installed kits, wrote the briefing pack and milestone briefs, and reviewed Codex's handoffs. Codex read those requirements and installed source, made small behavioral commits, ran unit/browser/chain checks and wrote exact results. The builder passed the resulting corrections back into the next authorized milestone. Neither an AI's proposed design nor its successful compilation counted as live evidence.

Concrete changes from that loop:

| Finding | What changed | Record |
|---|---|---|
| Public-key hints in Claude's original ticket brief identified recipients | Codex switched to two-recipient anonymous hybrid envelopes, rejected non-anonymous inputs and tested zero hints against every demo registry key | [M2 review](docs/reviews/M2-review.md), [anonymous run](evidence/m2b-ticket-anonymous.json) |
| M4's plaintext-hash opening anchors allowed guesses of small demo balances | The builder required ciphertext anchors for all new records; legacy mappings verify both hashes and explicitly treat old openings as disclosed | [M5 brief](docs/briefs/M5.md), [D15](DECISIONS.md), [legacy test](packages/core/test/legacy.test.ts) |
| A valid receipt can still describe an already booked payment | Verdicts track payment commitments across openable periods; M7 anchored two fresh, correctly bound receipts for one payment and refused the second | [M5 brief](docs/briefs/M5.md), [M7 duplicate](evidence/m7-duplicate.json) |
| The first Northwind screenshots showed privacy canaries instead of a believable ledger | The builder required a separate Privacy test (demo) book, a fresh fictional Northwind run and unmasked judge screenshots with a secret scan | [M8 brief](docs/briefs/M8.md) |
| Receive errors were collapsed into network errors | Non-network refusals retain their original codes, including JOURNAL_LOCKED; outsider anonymous opening reports DECRYPTION_FAILED | [M2 review](docs/reviews/M2-review.md), [ticket receive source](packages/chain/src/tickets/receive.ts) |
| A fixed 3M gas limit overpaid under Diana's 50% floor | Gas uses ceil(estimate × 1.25), a cap and checks against the signed window budget; the live fee-market query confirmed 0.5 | [M1 review](docs/reviews/M1-review.md), [gas evidence](evidence/m1-gas.json), [policy](evidence/m1-gas-policy.json) |

## What the AI got wrong

| Author / stage | Error | How it was caught and corrected |
|---|---|---|
| Claude, initial ideas | A paid members channel did not fit the builder's intended payment product | Builder rejected the idea and set the scope; [day 1 log](docs/ai-log/2026-11-20.md) |
| Claude, ticket brief | Required non-anonymous envelopes despite recipient-linkable hints | Claude's own M2 review acknowledged the error; anonymous correction and old evidence both retained |
| Claude, M6 brief | Suggested consolidation by self-send | Codex inspected the pinned pool: one input becomes two outputs, so it cannot merge notes. Builder withdrew that instruction and chose the four-note cap/refusal; [D16](DECISIONS.md) |
| Claude, scaffold | Named a pnpm script `env`, a pnpm built-in | Builder's first live command failed; renamed to `write-env`; [day 1 log](docs/ai-log/2026-11-20.md) |
| Codex, M1 | Used a fixed oversized gas limit; the unfunded fUSD attempt discarded useful diagnostics | Review required estimated gas, structured native errors and a funded conversion/shield run; original failed evidence remains |
| Codex, M2 | Mapped non-network receive failures to NETWORK_UNAVAILABLE | Review required original closed error codes; receive handling and tests changed |
| Codex, M4 | Anchored guessable opening plaintext hashes | M5 replaced new anchors with ciphertext hashes and documented the irrecoverable legacy disclosure |
| Codex, initial browser relay | Omitted the SDK's hash-only tx_search receipt query | Browser spike failed; allowlisted only the specific public hash query; [failed attempt and correction](docs/handoff/M5.md) |
| Codex, M8 setup | Repeated optional top-ups without first checking already-funded demo accounts; the deployer could not cover another transfer | A confirmed code-5 receipt was retained in evidence/m7b-funding-attempt.json. The runner now checks pinned public balances and uses existing client/business gas funds |
| Codex, M7 evidence | Left canary content in the judge book and masked the ledger | M8 separates privacy testing from the new fictional judge book; the first run is labelled superseded, not deleted |
| Codex, M7 browser test | Did not consume health-response bodies; traffic inspection remained unfinished | Bounded inspection reported the failure; consumed all response bodies and reran; [M7 handoff](docs/handoff/M7.md) |
| Claude/Codex, earlier AI_USAGE draft | Described a planned QCAI audit as completed | M8 removed the unsupported statement when no report existed. M13 subsequently records the four builder-exported PDFs and finding responses in docs/AUDIT.md |

## Generated vs human

| Area | AI generated / executed | Human contribution evidenced in the record |
|---|---|---|
| Product and scope | Claude researched competitors, proposed ideas and wrote PRD/threat/failure analysis | Builder chose Quaestor, its name, private rail, normal web app, category and honest Gloam wording |
| Initial infrastructure | Claude scaffolded contracts/scripts and ran offline spikes | Builder generated/funded test accounts and performed the first live deployment; [day 1 log](docs/ai-log/2026-11-20.md) |
| Payments and cryptography | Codex implemented wrappers, journals, tickets, registries, books, verdicts and live evidence runners | Builder supplied approved briefs and relayed corrections; Claude reviewed milestone handoffs |
| Storage and recovery | Codex built BlobBoard integration, legacy checks, encrypted browser vault/journal backup and original-hash recovery | Builder chose chain storage/Vercel, ciphertext anchors and the declared-opening boundary |
| UI and demonstration | Codex implemented the React screens, Muuve style adaptation, attack lab, browser journeys and responsive captures | Builder supplied Muuve as the style reference, specified demo amounts and required realistic fictional content |
| Submission materials | Codex wrote judge docs, claims gate, short script, original cover artwork and clean-clone checks | Builder specified fields and decides what to submit, host, record and publish |

## Verification limits

AI-generated code is checked by tests and live receipts, not trusted because another model agrees. Browser interception is scoped to exercised flows and known encodings. Claim mappings enforce recorded support and reviewed text, not semantic truth automatically. The pool's Groth16 proofs are not post-quantum. The QCAI two-stage audit is recorded in [AUDIT.md](docs/AUDIT.md), with all four PDFs and no post-quantum score. Independent human judge walkthrough, recorded final video and submitted project-page verification remain unperformed.

M9: the builder specified the deployed judge journey and UX brief; Codex implemented readable verdicts, one-click demo auditing, lazy route loading, resumable activation, accessibility checks and a manually funded fresh-signup evidence runner. The initial relay-blocked attempt is retained; the corrected deployment and original-account resume completed registration and payments with receipt-backed fees. The successful contexts, and the lost-response limit of the failed attempt, are recorded separately in the M9 handoff.

M13: the builder supplied all four QCAI PDFs and triage instructions. Codex mapped findings to source/tests, added a short-signature regression and pinned public live precompile probes, checked deployed UI labels/links/routes and prepared a fresh-clone gate/build run. The contract logic and vendor tree remain unchanged; the AI audit is not a security certification.
