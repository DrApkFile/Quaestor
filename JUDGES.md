# A 60-second path through Quaestor

The links below use the real local production-preview origin. Start it after `pnpm install --frozen-lockfile`, circuit preparation and `pnpm -C apps/web build`:

```sh
pnpm -C apps/web exec vite preview --host 127.0.0.1 --port 4173
```

Deployment steps: [docs/DEPLOY.md](docs/DEPLOY.md). No hosted deployment is claimed. This is a 60-second click path; initial circuit downloads and chain verification can take longer.

1. Open the [landing page](http://127.0.0.1:4173/). The pool is our deployment of Gloam's open-source pool on QoreChain Diana. Its Groth16/BN254 proofs are not post-quantum.
2. Open [Public check for Northwind Studio (demo)](http://127.0.0.1:4173/app?view=public&book=0x745c77ad45cf784d7a16e7ea12461f23ab9ea2d88a0f50bf6678262f76d6afc1), then **Check chain**. Only anchors, counts and ciphertext checks are public.
3. Save the JSON file from the [encrypted demo-auditor backup](http://127.0.0.1:4173/demo-auditor.json) ([committed copy](apps/web/public/demo-auditor.json)). Open [Auditor for the same book](http://127.0.0.1:4173/app?view=auditor&book=0x745c77ad45cf784d7a16e7ea12461f23ab9ea2d88a0f50bf6678262f76d6afc1), select that file, enter the passphrase below and click **Open granted period**. A and B have five readable MATCHED entries and two HOLDINGS_COVER_BOOKS results; populated C is NOT_GRANTED. Expand **Proof details** for a receipt and anchor transaction.
4. Open [attack lab (demo)](http://127.0.0.1:4173/attack-lab), then **Read attack book from chain**. It reads the preserved M4 cases and the separately anchored M7 duplicate. This page sends no transactions.
5. Inspect the [evidence table](#evidence-table) and [screenshots](evidence/m7-screens/).

The backup belongs to an intentionally public **testnet-only demo auditor**, holding only valueless faucet tokens. Its native address is `qor1u5lhadlcp5wqf2h3yds2jclqc4q4dyacqugkqp`. The published passphrase is intentional:

```text
Quaestor-demo-auditor-testnet-only-2026
```

The auditor opens only the granted periods. A later period uses an “opening balance as declared and signed by the business”; these checks do not establish correctness of that declared opening balance, complete income, real-world counterparty identity or metadata privacy.

## Evidence table

| Check | Recorded evidence |
|---|---|
| Northwind A/B MATCHED and holdings coverage; C refused | [M7 browser journey](evidence/m7-browser.json) |
| B-only grant and fresh-browser private-balance restore | [fresh B-only auditor](evidence/m7-fresh-auditors.json), [backup restore](evidence/m7-browser.json) |
| One real payment, two fresh correctly bound receipt proofs and anchors | [M7 duplicate](evidence/m7-duplicate.json) |
| TAMPERED, WRONG_CONTEXT and HOLDINGS_SHORT, historical M4 | [M4 verdicts](evidence/m4-verdicts.json) |
| Live browser attack checks, zero broadcasts, relay and CSP | [M7 attack browser](evidence/m7-attack-browser.json) |
| Responsive views; private ledger cells masked in published images | [390px and 1440px screenshots](evidence/m7-screens/) |
| Claim limits | [CLAIMS.md](CLAIMS.md), [threat model](THREAT_MODEL.md) |

The final demo command is `pnpm evidence --m7`. It needs the builder's local private test fixtures for writing and recovery. The judge path above needs only the public encrypted auditor backup, its passphrase and chain access.
