# A 60-second path through Quaestor

Open the deployed testnet app below. This is a 60-second click path; initial chain history and proof checks can take longer. The app shows progress while they run.

1. Open the [landing page](https://use-quaestor.vercel.app/). The pool is our deployment of Gloam's open-source pool on QoreChain Diana. Its Groth16/BN254 proofs are not post-quantum.
2. Open [Public check for Northwind Studio (demo)](https://use-quaestor.vercel.app/app?view=public&book=0xb878a86609f1492d103847d8625177cb64b800f0b6c25ee2115766be35a02a16), then **Check chain**. Only anchors, counts and ciphertext checks are public.
3. Open [Try the demo auditor](https://use-quaestor.vercel.app/app?view=auditor&book=0xb878a86609f1492d103847d8625177cb64b800f0b6c25ee2115766be35a02a16&demo=1). The intentionally public encrypted backup and published passphrase load automatically. A/B show five **Matches a real payment** results and two **Holdings cover the books** results; C says **Not shared with you**. Hover a badge for its technical code. Expand **Proof details** for receipt and anchor evidence. The **Use your own auditor backup** panel keeps the manual upload path.

4. Open [attack lab (demo)](https://use-quaestor.vercel.app/attack-lab), then **Read attack book from chain**. It reads the preserved M4 cases and the separately anchored M7 duplicate. This page sends no transactions.
5. Inspect the [evidence table](#evidence-table) and [screenshots](evidence/m7b-screens/).

The backup belongs to an intentionally public **testnet-only demo auditor**, holding only valueless faucet tokens. Its native address is `qor1u5lhadlcp5wqf2h3yds2jclqc4q4dyacqugkqp`. The published passphrase is intentional:

```text
Quaestor-demo-auditor-testnet-only-2026
```

The auditor opens only the granted periods. A later period uses an “opening balance as declared and signed by the business”; these checks do not establish correctness of that declared opening balance, complete income, real-world counterparty identity or metadata privacy.

The current book contains clearly fictional business entries: a single page banner identifies the demo; names have no repeated suffixes. The first completed Northwind run is retained as **superseded: canary content** in [its original evidence](evidence/m7-browser-initial.json) and [masked screenshots](evidence/m7-screens/). Traffic canaries now run only on **Privacy test (demo)**, book `0x2c0643bc8509426830f0c685470be8640af69129f84497b650e7968b0f12c291`.

## Evidence table

| Check | Recorded evidence |
|---|---|
| Northwind A/B MATCHED and holdings coverage; C refused | [M7b fictional browser journey](evidence/m7b-browser.json) |
| B-only grant and fresh-browser private-balance restore | [fresh B-only auditor](evidence/m7b-fresh-auditors.json), [backup restore](evidence/m7b-browser.json) |
| One real payment, two fresh correctly bound receipt proofs and anchors | [M7 duplicate](evidence/m7-duplicate.json) |
| TAMPERED, WRONG_CONTEXT and HOLDINGS_SHORT, historical M4 | [M4 verdicts](evidence/m4-verdicts.json) |
| Live browser attack checks, zero broadcasts, relay and CSP | [M7b attack browser](evidence/m7b-attack-browser.json) |
| Responsive views; fictional judge ledger shown without masking | [390px and 1440px screenshots](evidence/m7b-screens/) |
| Visible image text checked for local keys, mnemonics and note secrets | [OCR + visible-text secret scan](evidence/m7b-image-secret-scan.json) |
| Separate Privacy test canary journey and masked captures | [Privacy evidence](evidence/m8-privacy-browser.json), [privacy screenshots](evidence/m8-privacy-screens/) |
| First completed Northwind run, superseded: canary content | [Historical run](evidence/m7-browser-initial.json), [run index](evidence/m7-runs.json) |
| Claim limits | [CLAIMS.md](CLAIMS.md), [threat model](THREAT_MODEL.md) |

The final demo command is `pnpm evidence --m7b`. It needs the builder's local private test fixtures for writing and recovery. The judge path above needs only the public encrypted auditor backup, its passphrase and chain access.

## Run it yourself

Use Node 22.12+, pnpm 9.15 and Foundry. After `pnpm install --frozen-lockfile`, run `./scripts/vendor-gloam.sh`, `pnpm -C contracts forge-std`, `pnpm gate` and `pnpm -C apps/web build`. Start the production preview:

```sh
pnpm -C apps/web exec vite preview --host 127.0.0.1 --port 4173
```

Then use the same paths on your local preview origin. Deployment details: [DEPLOY.md](docs/DEPLOY.md). Real writing/recovery evidence needs the builder’s ignored private fixtures; the public demo auditor needs only the published encrypted [backup](https://use-quaestor.vercel.app/demo-auditor.json) and passphrase above.
