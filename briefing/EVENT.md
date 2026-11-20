# EVENT: Build Before Q-Day — The QoreChain Developer Fest (project: Quaestor)

Researched: 2026-11-20 (Lagos, UTC+1)
Sources: Prizes and Rules pages (pasted by the user, 2026-11-20); build.qorechain.io/start, /faq, /kits, /projects (fetched 2026-11-20).
The organiser says rules, prizes and dates may still change until the end of the event. Re-read /prizes and /rules on 27 Nov and 1 Dec.

## At a glance
| Item | Detail |
|---|---|
| Build window | 4 Nov – 2 Dec 2026. We start 20 Nov: **12 days left** |
| Deadline | **2 Dec 2026 23:59 UTC = 3 Dec 00:59 Lagos.** Project becomes read-only. No separate submit button |
| Our internal deadline | **2 Dec 20:00 UTC** (4 h buffer) |
| Checks | 3–5 Dec (automatic + manual) |
| Judging | 6–15 Dec, jury scores against the category rubric; finalists may get a change request with 48 h to answer |
| Winners | 16 Dec, live demo show |
| Paid | Stablecoin, 17–22 Dec |
| Category | **Encrypted Apps**, teams of 1–4. We are solo |
| Category prizes | 1st $1,500, 2nd $750. Only two winners |
| Field size | **21 Encrypted Apps projects** as of 20 Nov (99 projects total; Cross-VM has 5) |

## Category requirements (Encrypted Apps)
"Build an application using post-quantum encryption for QoreChain-addressed recipients."
Main requirements: ML-KEM-1024 encryption, registered recipient keys, ML-DSA key binding, client-side encryption and decryption.

## Scoring (from the organisers, 20 Nov — same for every category)
| Criterion | Weight | How Quaestor earns it | Where a judge sees it |
|---|---|---|---|
| Works as described | 25% | every demo act runs on testnet; README claims only what CLAIMS.md marks PROVEN | video, live app, evidence/ |
| QoreChain tech usage (verified in repo **and on chain**) | 25% | KEM + ML-DSA registries, hybrid-signed txs, EVM windows, pqcKeyStatus/pqcVerify, QoreSeal, QoreSign, SDK, create-qorechain-dapp — each with a tx hash | README requirements table, evidence/, project page kits |
| Post-quantum correctness and security | 20% | ML-KEM-1024 + X25519 hybrid, no classical fallback, keys only from the registry, ML-DSA binding checked; honest that Groth16 is not PQ | THREAT_MODEL.md, tests T-SEAL/T-BIND/T-TICKET, QCAI audit |
| Originality | 15% | per-period auditor access + verdicts against a private pool; PQ tickets replacing P-256 | README §1, LANDSCAPE |
| Clarity, UX and documentation | 15% | clean web app, JUDGES.md 60-second path, README, HOW_ITS_MADE | app, docs |

For Encrypted Apps, "tech usage" and "security" are judged against the four track requirements (ML-KEM-1024, registered recipient keys, ML-DSA key binding, client-side enc/dec). They must be **visible in the repo and on testnet and explained in the README**.
Top-Quality needs ≥ 70/100 on this rubric.

## Eligibility gates (acceptance IDs)
| ID | Requirement | How we verify | Evidence file |
|---|---|---|---|
| A01 | Public GitHub repo | `gh repo view --json visibility` | evidence/a01-repo.json |
| A02 | MIT or Apache-2.0, licence file in repo | file check in gate script | LICENSE |
| A03 | README; libraries, kits, templates credited | gate script greps README for every dependency in package.json | README.md#credits |
| A04 | Video ≤ 3 min showing it working | ffprobe duration < 180 s | evidence/a04-video.txt |
| A05 | Featured / cover image 16:9, ≥ 1200×675, ≤ 5 MB (rules: required; start page: optional → treat as required) | identify/ffprobe | public/cover.png |
| A06 | Testnet qor1 address(es) the project uses | listed in README and project page | README.md#on-chain |
| A07 | Registration complete: GitHub, X, QoreX testnet address | user confirmed 20 Nov | — |
| A08 | Built during the event; real commit history | commit as we go, never squash/rewrite | git log |
| A09 | ML-KEM-1024 encryption | tests T-SEAL-* | evidence/a09-* |
| A10 | Registered recipient keys (x/pqc KEM registry) | MsgRegisterKEMKey tx hashes; auditor reads `/qorechain/pqc/v1/kem/{addr}` | evidence/a10-kem-registrations.json |
| A11 | ML-DSA key binding | recipient cards verified against on-chain ML-DSA-87 + ML-KEM keys; manifests signed ML-DSA-87; contract requires `pqcKeyStatus.possessionProven` | evidence/a11-* |
| A12 | Client-side encryption and decryption | browser only; server and store never hold user keys or plaintext (test T-NOPLAIN-*) | evidence/a12-* |
| A13 | Tick only kits/features actually in code (verified from dependency files and from txs by the project's qor1 addresses) | project page "Check again" | screenshot |
| A14 | Install the QoreChain Build GitHub App | project page shows commits in feed | — |
| A15 | Best AI-Native: tick option + `AI_USAGE.md` (workflow, generated work, human contribution) | file exists | AI_USAGE.md |
| A16 | Country on project form (normally where the builder lives) | project page | — |
| A17 | Quantum Campus: the builder is enrolled during the fest; proof of enrolment ready to send by email when asked | student card or institution letter, kept off the repo | — |
| A18 | Top-Quality: pass **every** submission check (A01–A06) and aim for ≥ 70/100 | pre-submit-audit.md from a clean clone | evidence/a18-presubmit.txt |

## Prizes we can realistically compete for
| Prize | Amount | Condition | Odds note |
|---|---|---|---|
| Encrypted Apps 1st / 2nd | $1,500 / $750 | jury rubric | 21 entrants, several very rigorous |
| **Best AI-Native Build (target)** | $500 | tick AI-native on the form + `AI_USAGE.md` documenting the workflow, the generated work and the human contribution; jury picks the strongest documented use of AI | stacks with the category prize; daily log in docs/ai-log/ from day 1 |
| People's Choice | $500/$300/$200 | QoreX mainnet votes 6–15 Dec | needs community push on X |
| Regional (your region) | $200 | highest-scored project of the region with no other prize | the team picks its country on the project form |
| **Top-Quality (target floor)** | 7 × $250 | the 7 highest-scored projects that won **no other prize**, each ≥ 70/100 with the jury and passing **every** submission check | only if we win nothing else; it rewards the same things as the jury score: polished, functional, well documented |
| Q-Day Survivor | — | drill ran 18 Nov | **missed, not available** |
| **Quantum Campus (target)** | $500 | every team member enrolled at a university, college or school during the fest; jury picks candidates, then emails each member for proof of enrolment | stacks with the category prize; keep a student card or enrolment letter ready to email |

## How the prizes stack
- Category prize + Quantum Campus + Best AI-Native + People's Choice can all be won together (special awards are open on top of the category bounty unless they say otherwise).
- Top-Quality and Regional go only to projects that won **no other prize**, so they are the floor, not a stack.

## What judges read, in order (inferred, not stated)
Project page (description, "How it's made", kits ticked/verified) → README → video → repo code/tests → testnet transactions. Jurors check unverifiable items by hand in the repo (FAQ).

## Rules on commits and updates
- After 2 Dec 23:59 UTC the project is read-only except changes the jury requests from finalists. **No commits after the deadline.**
- Projects must be built during the event; prior work not allowed. All code in this repo starts 20 Nov.
- Copied projects are disqualified. Credit QoreSeal/QoreSign/SDK examples where adapted.

## Network facts
- Testnet `qorechain-diana`, EVM chain ID 9800, REST `https://api-testnet.qore.host` (from SDK docs and other entrants' READMEs; spike S02).
- Faucet: dashboard.qorechain.io/faucet (test QOR + fUSD/fETH/fBTC once per 24 h). Ask for test QOR for three reader accounts early.
- FAQ: "Nothing on mainnet is needed or counted." PQC precompiles active on diana, not on mainnet.

## Open questions for organisers (ask in Discord #developer-fest today)
1. ~~Is the Encrypted Apps scoring rubric published anywhere?~~ Answered 20 Nov (Scoring).
2. Is the two-stage QCAI audit (docs/audit/) expected for Encrypted Apps projects that deploy contracts, or only for Post-Quantum dApp?
3. Is the cover image required or optional? (/rules says required, /start says optional.)
4. Is there a recording of Workshop 3 (Encrypted apps, cross-VM)?
5. We deploy an MIT-licensed third-party shielded pool (Gloam's open-source contracts and SDK) ourselves on Diana as the payment rail, credited in the README, and build the app on top during the fest. Is that within "open source libraries may be used and must be credited"?
Record answers here with date and who answered.

### Answers (2026-11-20, relayed by the builder)
| Q | Answer |
|---|---|
| 1 rubric | **answered** — see Scoring above |
| 2 QCAI audit | not yet answered; **decision: do it anyway** on Books.sol (stage 1 → fix → stage 2), reports in docs/audit/, findings mapped in docs/AUDIT.md. Gloam contracts are vendored unmodified and excluded, stated in AUDIT.md |
| 3 cover image | we provide one (16:9, ≥ 1200×675, ≤ 5 MB) |
| 4 Workshop 3 | builder will provide notes as markdown → knowledge/workshop-3.md |
| 5 Gloam MIT contracts deployed by us | **yes, allowed** (credit in README + NOTICE) |
| 6 BN254 precompiles on Diana | **yes** (still confirm in practice with S03) |
