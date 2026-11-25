# A 60-second path through Quaestor

Open the deployed testnet app below. This is a 60-second click path; initial chain history and proof checks can take longer. The app shows progress while they run.

1. Open the [landing page](https://use-quaestor.vercel.app/). The pool is our deployment of Gloam's open-source pool on QoreChain Diana. Its Groth16/BN254 proofs are not post-quantum.
2. Open [Public check for Northwind Studio (demo)](https://use-quaestor.vercel.app/app?view=public&book=0xb878a86609f1492d103847d8625177cb64b800f0b6c25ee2115766be35a02a16), then **Check chain**. Only anchors, counts and ciphertext checks are public.
3. Open [Try the demo auditor](https://use-quaestor.vercel.app/app?view=auditor&book=0xb878a86609f1492d103847d8625177cb64b800f0b6c25ee2115766be35a02a16&demo=1). The intentionally public encrypted backup and published passphrase load automatically. A/B show five **Matches a real payment** results and two **Holdings cover the books** results; C says **Not shared with you**. Hover a badge for its technical code. Expand **Proof details** for receipt and anchor evidence. The **Use your own auditor backup** panel keeps the manual upload path.

4. Open [attack lab (demo)](https://use-quaestor.vercel.app/attack-lab), then **Read attack book from chain**. It reads the preserved M4 cases and the separately anchored M7 duplicate. This page sends no transactions.
5. Inspect the [evidence table](#evidence-table) and [screenshots](evidence/m9-screens/).

The backup belongs to an intentionally public **testnet-only demo auditor**, holding only valueless faucet tokens. Its native address is `qor1u5lhadlcp5wqf2h3yds2jclqc4q4dyacqugkqp`. The published passphrase is intentional:

```text
Quaestor-demo-auditor-testnet-only-2026
```

The auditor opens only the granted periods. A later period uses an “opening balance as declared and signed by the business”; these checks do not establish correctness of that declared opening balance, complete income, real-world counterparty identity or metadata privacy.

The current book contains clearly fictional business entries: a single page banner identifies the demo; names have no repeated suffixes. The first completed Northwind run is retained as **superseded: canary content** in [its original evidence](evidence/m7-browser-initial.json) and [masked screenshots](evidence/m7-screens/). Traffic canaries now run only on **Privacy test (demo)**, book `0x2c0643bc8509426830f0c685470be8640af69129f84497b650e7968b0f12c291`.

## Try it yourself

Use [the app](https://use-quaestor.vercel.app/app?view=account) with an empty browser profile:

1. Create an account with a passphrase and download its encrypted backup. Keep the backup and passphrase locally.
2. Copy the new qor1 address and claim free test QOR at the [faucet](https://dashboard.qorechain.io/faucet). It permits one claim per 24 hours. The app polls for funding; never automate the faucet.
3. Click **Activate quantum-safe account**. The three labels show signature registration, encryption-key registration and payment-card publication. **Details** contains algorithms and confirmed hashes/blocks. Retry resumes from chain state.
4. In **Wallet**, deposit **2 QOR** and confirm the transaction window if prompted. Public QOR pays gas; the pool balance is private.
5. In **Pay**, send **0.5 QOR** to the demo supplier: `qor1uz3zu3883m06vcguymnkxema9uantwxn8dmmw2`. The supplier's **Receive** scan opens and checks its anonymous ticket; this was exercised in a separate browser context.
6. Download an updated encrypted backup after payments; it includes the private journal. The earlier M9 wallet readback confirmed a remaining private balance of 1.5 QOR.

The later **uninterrupted M10 signup** completed account creation, encrypted backup, manual faucet funding, activation, a 2-QOR deposit and a 0.5-QOR private payment, with that exact ticket checked in the supplier's separate browser context. Activation took **63.851 seconds** and cost **0.319120916 QOR**. Observed fees for activation, deposit and payment totalled **0.818424821 QOR**, excluding the 2-QOR deposit principal; the 0.5-QOR payment spends that deposit. Fees and timing can change.

The whole attempt took **13 min 28 sec**, including **6 min 51 sec** waiting for manual funding, plus screenshots, axe checks, backups and supplier restoration. This is not a pure transaction-time benchmark. Payer and supplier contexts inspected **680/680** and **202/202** requests/responses with zero known-secret matches, inspection errors or pending inspections. All 12 new captures fit at 390/1440 and have zero axe violations; the complete 58-image M10 recheck passed OCR, visible-text and image-hash coverage checks. [Immutable M10 attempt](evidence/m10-signup-attempts/m10-1795594340224-d0023e20cd51bf67/report.json), [receipt and fee rereads](evidence/m10-signup-cost.json), [image secret scan](evidence/m10-image-secret-scan.json). The first M10 manual-funding timeout remains [FAILED on record](evidence/m10-fresh-signup-attempt-1795595160341.json); it was not resumed.

Earlier **M9 resumed-account activation**: **44.574 seconds**, **0.319120916 QOR** in fees. The measured funding estimate adds a 25% buffer, rounded up to **0.4 QOR**; keep additional public QOR for transaction fees and the 2-QOR deposit. Gas prices and timing can change. The successful automated flow took 5.9 minutes including screenshots, accessibility checks and backup work; that is not a pure transaction-time benchmark.

[M9 resumed flow and receipts](evidence/m9-fresh-signup.json), [gas/fee rereads](evidence/m9-activation-cost.json). The first browser created and backed up this new account, but the broken relay prevented its balance poll from seeing the builder's 100-QOR faucet funding. Its failed report is retained in `evidence/m9-fresh-signup-attempt-1795424427899.json`. After the routing fix, an empty browser restored that original encrypted account and performed its first registrations and payments. No completed payment was repeated. The failed attempt had 545 requests and 544 inspected responses; it is not a complete privacy pass. The successful payer and supplier contexts inspected 351/351 and 155/155 requests/responses, with zero known-secret matches, errors or pending inspections.

## Evidence table

| Check | Recorded evidence |
|---|---|
| Northwind A/B MATCHED and holdings coverage; C refused | [M7b fictional browser journey](evidence/m7b-browser.json) |
| B-only grant and fresh-browser private-balance restore | [fresh B-only auditor](evidence/m7b-fresh-auditors.json), [backup restore](evidence/m7b-browser.json) |
| One real payment, two fresh correctly bound receipt proofs and anchors | [M7 duplicate](evidence/m7-duplicate.json) |
| TAMPERED, WRONG_CONTEXT and HOLDINGS_SHORT, historical M4 | [M4 verdicts](evidence/m4-verdicts.json) |
| Live browser attack checks, zero broadcasts, relay and CSP | [M7b attack browser](evidence/m7b-attack-browser.json) |
| Responsive views; fictional judge ledger shown without masking | [M9 before/after screenshots](evidence/m9-screens/) |
| Visible image text checked for local keys, mnemonics and note secrets | [M9 OCR + visible-text secret scan](evidence/m9-image-secret-scan.json), [historical M7b scan](evidence/m7b-image-secret-scan.json) |
| Separate Privacy test canary journey and masked captures | [Privacy evidence](evidence/m8-privacy-browser.json), [privacy screenshots](evidence/m8-privacy-screens/) |
| First completed Northwind run, superseded: canary content | [Historical run](evidence/m7-browser-initial.json), [run index](evidence/m7-runs.json) |
| Live deployed routes, headers and read-only judge path | [Deployment](evidence/m9-deploy.json), [M9 live judge checks](evidence/m9-judge-after.json) |
| Uninterrupted new M10 account, native deposit/payment and checked supplier receipt | [M10 attempt](evidence/m10-signup-attempts/m10-1795594340224-d0023e20cd51bf67/report.json), [receipt fees](evidence/m10-signup-cost.json), [58-image secret scan](evidence/m10-image-secret-scan.json) |
| First registration, native payment and supplier receipt | [M9 original-account resume](evidence/m9-fresh-signup.json), [observed gas/fees](evidence/m9-activation-cost.json) |
| Corrected manual auditor retry; restored 1.5 QOR without transactions | [Manual retry](evidence/m9-manual-retry.json), [latest-build backup readback](evidence/m9-readback.json) |
| Claim limits | [CLAIMS.md](CLAIMS.md), [threat model](THREAT_MODEL.md) |

The final demo command is `pnpm evidence --m7b`. It needs the builder's local private test fixtures for writing and recovery. The judge path above needs only the public encrypted auditor backup, its passphrase and chain access.

## Run it yourself

Use Node 22.12+, pnpm 9.15 and Foundry. After `pnpm install --frozen-lockfile`, run `./scripts/vendor-gloam.sh`, `pnpm -C contracts forge-std`, `pnpm gate` and `pnpm -C apps/web build`. Start the production preview:

```sh
pnpm -C apps/web exec vite preview --host 127.0.0.1 --port 4173
```

Then use the same paths on your local preview origin. Deployment details: [DEPLOY.md](docs/DEPLOY.md). Real writing/recovery evidence needs the builder’s ignored private fixtures; the public demo auditor needs only the published encrypted [backup](https://use-quaestor.vercel.app/demo-auditor.json) and passphrase above.
