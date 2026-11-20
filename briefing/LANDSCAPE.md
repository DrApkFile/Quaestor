# LANDSCAPE — Quaestor

Researched: 2026-11-20 from build.qorechain.io/projects (99 projects; Encrypted Apps 21) and public READMEs. Re-check 27 Nov.

## House style at this event
Requirement-by-requirement evidence tables with tx hashes and block numbers; "nothing claimed live until it has a row in EVIDENCE.md"; named refusals; a JUDGES.md path. Peal, Allot, Blind Crossing, Vigil set the bar. Match it.

## Nearest neighbours
| Project | Category | What it does | Overlap | Our positioning line |
|---|---|---|---|---|
| **Veil** | Protocol Builders | auditable payments with sealed invoices; payee and auditor decrypt; inside a rollup | **closest idea** | Veil seals invoices inside its rollup with one standing auditor. Quaestor keeps a business's whole books, hides amounts through a shielded pool, grants one quarter at a time, and checks every entry against the pool |
| TravelSeal | Encrypted Apps | travel-rule data between exchanges | compliance framing | exchange-to-exchange messages, not a business's books |
| Cista | Encrypted Apps | sealed payroll, each employee reads own payslip | sealed payment docs | one-way payslips; no auditor scoping, no reconciliation |
| Ava | Encrypted Apps | board packs only directors can open | scoped readers | documents, not payments |
| Courier, Whisper | Encrypted Apps | PQ messaging and files | sealing to addresses | conversations, not accounting |
| Agama | (other) | sealed KYC and loan tape, ML-KEM | institutional records | lending vault, not general books |
| Verac | AI Agents | DAO ops incl. encrypted document vault | sealed docs | agent workflow, not books |
| Cloister | Protocol Builders | private ZK rollup | privacy rail | a rollup; we reuse an existing pool and build the books on top |

No project in the list combines **private payments + sealed books + per-period auditor access + verification against the chain**. Read Veil's README in full on day 1 and sharpen the line above.

## The gap
Privacy-payment products lose to "but my accountant needs to see it". Compliance products give up privacy. Quaestor: private to everyone, provable to one reader, for one period.

## Prepared judge questions
- **Q: Isn't this just Gloam?** A: No. Gloam is the open-source pool we deploy (credited). Our work is the books, the quarter keys and grants, the verdict engine, reconciliation, and replacing Gloam's P-256 payment tickets with ML-KEM-1024 to QoreChain-registered keys. We use none of Gloam's services.
- **Q: Why post-quantum here?** A: Financial records are kept 7–10 years. NIST's final IR 8547 (27 Oct 2026) deprecates classical key exchange after 2030 and disallows it after 2035. Ciphertext posted on a public chain today can be harvested now and decrypted then.
- **Q: Is the pool post-quantum?** A: No, Groth16 on BN254 isn't. We say so. Our claim is confidentiality of tickets and books.
- **Q: Can the business hide income?** A: If payer and business collude off the board, yes. Hidden spending from booked funds is caught by the reconciliation. We state the limit.
- **Q: What if the auditor leaks Q3?** A: They can; encryption can't stop a reader copying. Grants are scoped so the damage is one quarter.
