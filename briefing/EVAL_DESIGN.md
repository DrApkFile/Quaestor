# EVAL_DESIGN — Quaestor (preregistered 2026-11-20)

Security claims, tested as falsifiable acceptance tests fixed before building. Thresholds don't change after results; a change starts a new labelled run.

| Claim | Falsified if | Test / run |
|---|---|---|
| C1 A payee opens its ML-KEM-sealed ticket and spends the note; nobody else opens it | any other demo account opens the ticket, or the payee can't spend | T-E2E-DIANA act 1, separate browser profiles |
| C2 An auditor reads exactly the granted period | the auditor opens any entry of a period it wasn't granted | T-E2E-DIANA act 4 + unit T-SEAL-PERIOD |
| C3 Every honest entry on the demo book is `MATCHED` | any honest entry gets another verdict | audit over **all** entries of the book, not a chosen subset |
| C4 Tampered, invented and receipt-reused entries are caught | any of them is `MATCHED` | attack-lab book on Diana, audited by a machine that never held the business key |
| C5 No plaintext or secret leaves the browser | any request/response contains a canary string, note secret or key | T-NOPLAIN-WEB |
| C6 (only if D5) A hidden payment from booked funds makes the period `DOES_NOT_ADD_UP` | the hidden-payment period shows `ADDS_UP` | T-RECON-HIDDEN |

## Rules
- Authored test data is declared: canary strings, demo accounts, the attack-lab cases.
- Ceiling check (day 5): each verdict in the closed set is produced on constructed inputs; any verdict we can't produce means the engine is wrong.
- Ablation: turn off the context check in step 5 of the verdict engine and show the reused-receipt attack then passes as `MATCHED`. That proves the context binding is what catches it. Same for the root-history check (old root vs. forged root).
- Scale: the demo book is small (a handful of entries). Add a labelled synthetic benchmark: 500 entries, time to audit a period, store size.
- End-to-end crude run by day 7 (a real private payment with a PQ ticket and one anchored entry).
