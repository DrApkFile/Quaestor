# CLAIMS

README, project page and video may repeat only claims marked PROVEN here. Each claim names its evidence. Status is PROVEN or NOT PROVEN.

| ID | Claim | Status | Evidence | What it does not establish |
|---|---|---|---|---|
| C1 | Supplier1 opens its anonymous hybrid ML-KEM-1024 + X25519 ticket from our memo board and spends the note; the registered non-recipient client is refused (the payer has an authorized self-copy) | PROVEN (live + tests) | evidence/m2b-ticket-anonymous.json (anonymous correction); evidence/m2-ticket.json (historical non-anonymous); packages/chain/test/tickets.test.ts | Groth16 soundness; metadata privacy (the memo board is public); browser behaviour; payer anonymity: the payer’s EVM address sends the private send and the memo post (no relay) |
| C2 | A fresh auditor process opens both anchored entries in granted demo period A and is refused the populated, ungranted period B | PROVEN (live + tests) | evidence/m3-books.json; evidence/m3-precompiles.json; packages/core/test/books.test.ts; contracts/test/Books.t.sol | receipt Groth16 verification or soundness; reconciliation; completeness of bookkeeping; browser behaviour; metadata privacy or payer anonymity; protection against an authorized auditor sharing keys/plaintext |
| C3 | Every honest entry on the demo book is MATCHED | NOT PROVEN | — | — |
| C4 | Tampered, invented and receipt-reused entries are caught | NOT PROVEN | — | — |
| C5 | No plaintext or secret leaves the browser | NOT PROVEN | — | — |
| C6 | A hidden payment from booked funds makes the period DOES_NOT_ADD_UP | NOT PROVEN | — | — |
| S01 | QoreSeal envelopes can be checked against public keys | PROVEN (offline) | spikes/s01-output.txt | nothing about the live chain |
| S02 | Gloam SDK builds a valid shield proof for chain 9800 with our pool address | PROVEN (offline) | spikes/s02-output.txt | — |
| M0 | Our deployment of Gloam's pool is live on QoreChain testnet, and Diana verifies a real Groth16 proof on chain and rejects a tampered one | PROVEN (live) | evidence/m0-deploy.json, spikes/s03-output.txt, spikes/s04-output.txt | that deposits, sends and cash-outs work end to end (M1) |
| M1 | A business shields 5 native QOR, privately sends a 2-QOR note locally to supplier1, and supplier1 unshields it on Diana; ordered log replay matches the pinned pool root | PROVEN (live) | evidence/m1-roundtrip.json, evidence/m1-logrange.json | PQ ticket confidentiality, fUSD conversion/payments, browser behavior, anonymity guarantees or post-quantum Groth16 soundness |
| M1b | Deployer funds business with 100 bank fUSD; business converts it to ERC-20, then approves and shields 50 fUSD | PROVEN (live) | evidence/m1b-fusd.json | further fUSD payment paths, PQ tickets, browser behavior or post-quantum pool proofs |
