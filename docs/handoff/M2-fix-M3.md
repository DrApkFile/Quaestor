# Handoff M2-fix-M3 — anonymous tickets, strict lint, cached tree, sealed books

Date (UTC): 2026-11-21 (live evidence recorded 2026-11-20)
Agent: Codex
Commits: d2eea7d..796144b; handoff committed separately after these behavioural/evidence commits.

- `d2eea7d` Require anonymous hybrid tickets and preserve receiver error codes
- `87a4ae7` Record the anonymous one-QOR ticket run and preserve journal refusal codes
- `ff7b060` Enforce ESLint 9 strict type-checked rules in every TypeScript package
- `836aec0` Cache inclusion tree replay per gateway while checking each pinned root
- `8479f98` Confirm Diana PQ precompiles and document M3 wire encodings
- `b12ad79` Seal signed period books and enforce PQ-verified ordered anchors
- `5581269` Run anchored encrypted books with anonymous incoming payment and isolated auditor
- `ef95514` Test signature rejection after a tampered blob digest is recomputed
- `796144b` Record live anonymous books run and scope the proven auditor-period claim

## Done-when checklist

M3 list from docs/MILESTONES.md:

- [x] `packages/core`: entry codec, period keys, grant and close records; ML-DSA-87 signatures via QoreSign.
- [x] `contracts/src/Books.sol` + Foundry tests (T-BOOKS-*), deployed on Diana.
- [x] Entries anchored for M2's payments; a grant for one period to the auditor account.

Additional builder requirements, completed in A → B → C order:

- [x] Anonymous hybrid tickets with two recipients; non-anonymous envelopes rejected; both expected outsider errors skipped silently.
- [x] All-zero hints cannot be matched using the four project registry public keys; unit regression and new labelled live M2b run. Original M2 evidence retained.
- [x] Client returns DECRYPTION_FAILED; supplier opens/checks/unshields the real 1-QOR M2 change payment in a separate process/journal.
- [x] Review, M2 erratum, C1 payer-anonymity exclusion and relay roadmap recorded. JOURNAL_LOCKED and other receive error codes preserved.
- [x] ESLint 9 strict-type-checked/no-explicit-any/no-floating-promises in all TS packages; findings fixed; gate runs real lint tasks.
- [x] One cached createTreeSync per gateway; incremental replay and pinned currentRoot check tested.
- [x] S09/S16 confirmed before Books implementation; active precompiles selected, no fallback.
- [x] Real receipt proofs generated locally for both earlier supplier payments and the incoming anonymous client payment; three sealed/signed entries anchored across A/B.
- [x] A closed on chain, A granted to auditor; business self-copies for A/B; B contains one entry and has no auditor grant.
- [x] Fresh auditor PID 88780 loads only auditor keys, opens both A entries, checks anchored hashes/signatures/chain/close at pinned height 10434968, and is refused B.
- [x] Full gate passes; m3-books.json exists; C2 scoped to demonstrated access/integrity, not receipt verdicts or browser behaviour.
- [x] This handoff is written. M4 has not started.

## What changed

- `packages/chain/src/tickets/*`: mandatory anonymous hybrid tickets, expected outsider scan skips, retained non-network errors, replay-safe memo state.
- `packages/chain/scripts/m2bTicket.ts`: isolated labelled 1-QOR correction with fresh supplier/client workers and hint checks.
- `eslint.config.mjs`, package lint scripts and TS boundary fixes: actual strict type-checked workspace lint. Sequential lint bounds memory.
- `packages/chain/src/tree.ts`, gateway and tree tests: persistent incremental tree sync; backward pins reset; every inclusion checks pinned currentRoot.
- `packages/core/src/*`: canonical entry codec, supplied period-key entropy/time, hybrid blob signatures, chained ciphertexts, anonymous grants, self-copies, minimal close records and context binding. No network or current-clock reads.
- `contracts/src/Books.sol`: proven algorithm-1 owner registration; owner-only ordered anchors; immutable grants; domain-bound raw ML-DSA close verified by Diana; entry lock on close. Seven Foundry tests mock precompiles.
- `packages/chain/src/books.ts`, journal/executor: BOOKED → ANCHORED only after receipt; already-booked/anchored payments are resolved without a new broadcast. All three source payment journals now show ANCHORED.
- `packages/chain/scripts/m3*.ts`, root evidence wrappers: deployment through estimated-gas gateway, client incoming anonymous ticket, real local receipt proofs, durable operation journals and fresh auditor process.
- `cards/`: client public card added for its incoming-payment self-copy. Cards use strict public-only schemas.
- `evidence/*`, CLAIMS, README, REALITY_SPIKES, milestone and AI logs: observed results and explicit limits.

## Commands run and their real output

Output excerpts below are from captured command output, not invented results. Full final gate output follows. Forge runs through workspace tests and once explicitly: 7 distinct contract tests, not 14. TypeScript tests total 42 (4 core + 38 chain).

The first gate stopped on two unused core-test imports. The intended tampered-digest signature assertion was added in ef95514. Earlier integration type/lint findings were corrected before the successful live run. The final gate exited 0.

```text
$ pnpm evidence --m2
> quaestor@ evidence /home/kingghidorah/Documents/projects/bounties/quaestor
> pnpm -C packages/chain exec tsx ../../scripts/evidence.ts "--m2"

{
  "command": "pnpm evidence --m2",
  "label": "m2b-ticket-anonymous",
  "commit": "d2eea7db17c17be79dc5a2e91b45e57f5ecb89b5",
  "at": "2026-11-20T12:40:51.374Z",
  "demo": true,
  "status": "PASSED",
  "anonymous": true,
  "ticket": {
    "bytes": 3786,
    "mode": "hybrid",
    "recipients": 2
  },
  "registeredKeyCount": 4,
  "hintsUnlinkable": true,
  "window": {
...
"client": {
    "role": "client",
    "pid": 82720,
    "loadedAccounts": [
      "client"
    ],
    "journal": ".accounts/m2b/client.json",
    "journalInitiallyEmpty": true,
    "scanBlock": "10433319",
    "memoHash": "0x4438d004b7adf24786fb7ddc0b61822a85219966745a896044d3f2cfffba5efd",
    "commitment": "0x28af58734a7a4d58d881adb11340a1079bf6244e482dbbcd132b35fd056658d3",
    "openCode": "DECRYPTION_FAILED",
    "treeIncluded": false,
    "treeRoot": null,
    "notesAfterScan": 0,
    "scanErrors": [
      {
        "commitment": "0x1e6dd5457663610295bede015de08c29ff53f6e2bd51b545b167226e711879e6",
        "code": "TICKET_INVALID"
      }
    ],
    "unshield": null,
    "window": null,
    "before": null,
    "after": null,
    "balanceMatched": null
  }
}
```

```text
$ pnpm evidence --m3-spikes
> quaestor@ evidence /home/kingghidorah/Documents/projects/bounties/quaestor
> pnpm -C packages/chain exec tsx ../../scripts/evidence.ts "--m3-spikes"

{
  "command": "pnpm evidence --m3-spikes",
  "commit": "836aec01ae8e0697be3d288bef1bc4e19ecf9970",
  "at": "2026-11-20T12:59:07.484Z",
  "block": "10434078",
  "business": "0x61D3d2B524ef290C13ec8580Bf83D85b9AD332ab",
  "registered": true,
  "algorithm": 1,
  "possessionProven": true,
  "publicKeyMatches": true,
  "publicKeySha3": "0xec6a7e1f4958d648cc1ba188092ed96d1831cafc2caf7e0909193bc31ce33bec",
  "messageBytes": 32,
  "signatureBytes": 4627,
  "accepted": true,
  "flippedRejected": true,
  "context": "",
  "prehash": false,
  "source": "https://github.com/qorechain/qorechain-core/blob/main/docs/EVM_PRECOMPILES.md#pqcverify-0x0a01"
}
```

```text
$ pnpm evidence --m3
> quaestor@ evidence /home/kingghidorah/Documents/projects/bounties/quaestor
> pnpm -C packages/chain exec tsx ../../scripts/evidence.ts "--m3"

M3: deploy Books
M3: anonymous incoming client payment
M3: build real receipt proofs and seal entries
M3: register, anchor, close and grant
M3: fresh auditor process
{
  "command": "pnpm evidence --m3",
  "commit": "5581269348afbb6949e01f15c85de0f4c88f30de",
  "at": "2026-11-20T13:20:23.335Z",
  "status": "PASSED",
  "demo": true,
  "labels": "demo-scale periods; all counterparties labelled (demo) inside encrypted entries",
  "book": "0x61760c06d3f70e4b985aab05702161525ff3a27ddc3a39919ba32b20b43a0c87",
  "contract": "0xd81b97057a3e80b5005194466a8f6b0c93915d6a",
...
"auditor": {
    "pid": 88780,
    "loadedAccounts": [
      "auditor"
    ],
    "periodA": {
      "decryptedEntries": 2,
      "anchorHashesVerified": 2,
      "signaturesVerified": 2,
      "chainVerified": true,
      "closeVerified": true,
      "grantOpened": true
    },
    "periodB": {
      "code": "NOT_GRANTED",
      "entryCount": "1",
      "auditorGrantAbsent": true,
      "cryptoRefusal": "DECRYPTION_FAILED"
    },
    "book": "0x61760c06d3f70e4b985aab05702161525ff3a27ddc3a39919ba32b20b43a0c87",
    "block": "10434968"
  },
  "doesNotEstablish": [
    "receipt proof verification (M4)",
    "Groth16 post-quantum soundness",
    "payer anonymity",
    "browser behaviour",
    "reconciliation"
  ]
}
```

```text
$ pnpm gate
> quaestor@ gate /home/kingghidorah/Documents/projects/bounties/quaestor
> pnpm typecheck && pnpm lint && pnpm test && pnpm -C contracts test


> quaestor@ typecheck /home/kingghidorah/Documents/projects/bounties/quaestor
> pnpm -r --if-present typecheck

Scope: 5 of 6 workspace projects
packages/core typecheck$ tsc --noEmit
scripts typecheck$ tsc --noEmit
tools/evm-window typecheck$ tsc --noEmit
tools/evm-window typecheck: Done
packages/core typecheck: Done
scripts typecheck: Done
packages/chain typecheck$ tsc --noEmit
packages/chain typecheck: Done

> quaestor@ lint /home/kingghidorah/Documents/projects/bounties/quaestor
> pnpm -r --workspace-concurrency=1 --if-present lint

Scope: 5 of 6 workspace projects

> @quaestor/core@0.0.0 lint /home/kingghidorah/Documents/projects/bounties/quaestor/packages/core
> eslint src test


> @quaestor/scripts@ lint /home/kingghidorah/Documents/projects/bounties/quaestor/scripts
> eslint *.ts


> @quaestor/evm-window@0.0.0 lint /home/kingghidorah/Documents/projects/bounties/quaestor/tools/evm-window
> eslint scripts


> @quaestor/chain@0.0.0 lint /home/kingghidorah/Documents/projects/bounties/quaestor/packages/chain
> eslint src scripts test


> quaestor@ test /home/kingghidorah/Documents/projects/bounties/quaestor
> pnpm -r --if-present test

Scope: 5 of 6 workspace projects
contracts test$ forge test
packages/core test$ vitest run --maxWorkers=1 --minWorkers=1
contracts test: No files changed, compilation skipped
contracts test: Ran 7 tests for test/Books.t.sol:BooksTest
contracts test: [PASS] testBadSignatureRefusedAndPeriodRemainsOpen() (gas: 73371)
contracts test: [PASS] testCloseBindsExactDomainAndLocksEntries() (gas: 376803)
contracts test: [PASS] testDuplicateBookRefused() (gas: 44396)
contracts test: [PASS] testGrantAfterCloseAllowedButCannotBeOverwritten() (gas: 203606)
contracts test: [PASS] testRegistrationRequiresProvenAlgorithmOne() (gas: 344309)
contracts test: [PASS] testRejectsOutOfOrderAndBrokenPreviousHash() (gas: 178319)
contracts test: [PASS] testRejectsWrongOwner() (gas: 90464)
contracts test: Suite result: ok. 7 passed; 0 failed; 0 skipped; finished in 301.06ms (6.93ms CPU time)
contracts test: Ran 1 test suite in 302.07ms (301.06ms CPU time): 7 tests passed, 0 failed, 0 skipped (7 total tests)
contracts test: Done
packages/core test:  RUN  v2.1.9 /home/kingghidorah/Documents/projects/bounties/quaestor/packages/core
packages/core test:  ✓ test/books.test.ts (4 tests) 337ms
packages/core test:  Test Files  1 passed (1)
packages/core test:       Tests  4 passed (4)
packages/core test:    Start at  07:08:12
packages/core test:    Duration  14.73s (transform 477ms, setup 0ms, collect 13.39s, tests 337ms, environment 0ms, prepare 623ms)
packages/core test: Done
packages/chain test$ vitest run --maxWorkers=1 --minWorkers=1
packages/chain test:  RUN  v2.1.9 /home/kingghidorah/Documents/projects/bounties/quaestor/packages/chain
packages/chain test:  ✓ test/tickets.test.ts (8 tests) 7719ms
packages/chain test:  ✓ test/executor.test.ts (7 tests) 70ms
packages/chain test:  ✓ test/kemRegistry.test.ts (5 tests) 57ms
packages/chain test:  ✓ test/native.test.ts (4 tests) 24ms
packages/chain test:  ✓ test/gateway.test.ts (3 tests) 136ms
packages/chain test:  ✓ test/tree.test.ts (3 tests) 1617ms
packages/chain test:    ✓ T-TREE pages every deployment block and checks only the root at the pinned height 1590ms
packages/chain test:  ✓ test/memoBoard.test.ts (2 tests) 244ms
packages/chain test:  ✓ test/pool.test.ts (2 tests) 27ms
packages/chain test:  ✓ test/fusd.test.ts (1 test) 32ms
packages/chain test:  ✓ test/prover.test.ts (1 test) 3683ms
packages/chain test:    ✓ T-PROVER verifies a real offline single-threaded shield proof against the self-hosted checking key 3681ms
packages/chain test:  ✓ test/m2Pay.test.ts (1 test) 32ms
packages/chain test:  ✓ test/config.test.ts (1 test) 14ms
packages/chain test:  Test Files  12 passed (12)
packages/chain test:       Tests  38 passed (38)
packages/chain test:    Start at  07:08:27
packages/chain test:    Duration  49.85s (transform 767ms, setup 0ms, collect 30.44s, tests 13.66s, environment 6ms, prepare 1.88s)
packages/chain test: Done

> @quaestor/contracts@ test /home/kingghidorah/Documents/projects/bounties/quaestor/contracts
> forge test

No files changed, compilation skipped

Ran 7 tests for test/Books.t.sol:BooksTest
[PASS] testBadSignatureRefusedAndPeriodRemainsOpen() (gas: 73371)
[PASS] testCloseBindsExactDomainAndLocksEntries() (gas: 376803)
[PASS] testDuplicateBookRefused() (gas: 44396)
[PASS] testGrantAfterCloseAllowedButCannotBeOverwritten() (gas: 203606)
[PASS] testRegistrationRequiresProvenAlgorithmOne() (gas: 344309)
[PASS] testRejectsOutOfOrderAndBrokenPreviousHash() (gas: 178319)
[PASS] testRejectsWrongOwner() (gas: 90464)
Suite result: ok. 7 passed; 0 failed; 0 skipped; finished in 3.05ms (3.14ms CPU time)

Ran 1 test suite in 17.07ms (3.05ms CPU time): 7 tests passed, 0 failed, 0 skipped (7 total tests)
```

Additional read-only checks: `git diff --check` and `git diff --name-only 6a29306 -- contracts/vendor/gloam/` both emitted no output. A local Python helper compared repository files and new commit diffs against local mnemonic/private-key/note-secret values without printing them; no matches. Runtime evidence guards also check derived signing/seal keys, epoch-key bytes and relevant note secrets. These checks do not prove browser/network confidentiality (C5).

## On-chain evidence

Network: qorechain-diana, EVM chain 9800. All listed EVM receipts succeeded.

Books: `0xd81b97057a3e80b5005194466a8f6b0c93915d6a`.
Book ID: `0x61760c06d3f70e4b985aab05702161525ff3a27ddc3a39919ba32b20b43a0c87`.
Demo A: 2026-11-20, closed with two entries. Demo B: 2026-11-21, open with one entry. Dates are demo book labels; B's entry was also anchored during the 20 Nov run.

Evidence filenames below are relative to `evidence/`; each includes gas/receipt observations. Per-entry blob SHA3 and previous hashes are in m3-books.json. Native windows have Cosmos-format hashes.

| What | Tx hash / address | Block | Evidence file |
|---|---|---|---|
| M2b business window | `3A8964FF902A8F5F586868C9FC05FE850EA755658146CD926071CC6E8A1B8B99` | 10433269 | m2b-ticket-anonymous.json |
| M2b 1-QOR send | `0xc0ae5028d166759c9529d1e4bce3589a40bed7d2d244f9ab900a02ce6d21fe7a` | 10433277 | m2b-ticket-anonymous.json |
| M2b anonymous memo | `0x4438d004b7adf24786fb7ddc0b61822a85219966745a896044d3f2cfffba5efd` | 10433280 | m2b-ticket-anonymous.json |
| M2b supplier window | `6AF2A84FC865D68473990BA00AF8911BC10A6417C4A2C26F308DD9FC4E2B127F` | 10433295 | m2b-ticket-anonymous.json |
| M2b supplier unshield | `0xaea0f2bc7fa0a1a96e86545623861d589f86b34502b1d026fce26d76bfaf4469` | 10433304 | m2b-ticket-anonymous.json |
| M3 deployer window | `FF71DCD6F0C4FD4E5C93907AA810C11F83328E8DC23A43E400E396E62CDD5F28` | 10434859 | m3-books.json |
| Books deployment | `0x27759b94461442fab588b53ff0b8a503fb78f91eb9afeddf97a6b60687ecc332` | 10434863 | m3-books.json |
| M3 business window | `8A29096B4FAD2379091CB2CE68BDAD2B078490EB255A4352D709177E2A399299` | 10434931 | m3-books.json |
| Register book | `0x2d3195db0bf2fe402d1f50e2422afdfb16a1770d48b0c9648f114261f7f87dd0` | 10434936 | m3-books.json |
| Entry 2026-11-20 / 0 | `0xe68979e35e49d698afae9eaf7f18b1f19bede840e228e92a67277556d5340047` | 10434938 | m3-books.json |
| Entry 2026-11-20 / 1 | `0xd93c428892f978bc65cd0f0269965bd102efeb40f1cd5e1bb416144323211b1d` | 10434940 | m3-books.json |
| Entry 2026-11-21 / 0 | `0x23c06cbe7099b51852bb9fa3c9669a6ceb045419fba4ccac63e9d60bc9a08daf` | 10434942 | m3-books.json |
| Close A | `0x572e58fb84757b0207ab9f4de71a57a80a221ece7cd0cbfc2f84a8b05a2f814f` | 10434945 | m3-books.json |
| Grant auditorA | `0x67a4efcb5bd7bf4d2284495ae10b26842e2bd195205eda9b0a31ad0ac05fd184` | 10434947 | m3-books.json |
| Grant selfA | `0xcd80960e87da8ac73efb6ca4d537b554f2b9fe763113c32bf4f7af742332d77d` | 10434949 | m3-books.json |
| Grant selfB | `0xeb2f1ff228c693757d9d819d90a348b3a9888c06cead7d677e65032730c5a55f` | 10434951 | m3-books.json |
| M3 client window | `74B92FA8393C103F1AE0C9B1AE721A4651EEA2BB7F5D5490D3C5A02598E481B3` | 10434868 | m3-books.json |
| Incoming client shield | `0x3d06a85cb15b8b62351de8ef5f4f33819b8eaf123993ca3ed1d9b0a4df593761` | 10434888 | m3-books.json |
| Incoming client send | `0x99209db9a4df4bff43941699b0398aac50acb4f6b003bc3d38fc8ee4a119a93c` | 10434902 | m3-books.json |
| Incoming client memo | `0x83cf5ed3e62ea946c6f1c828b7e7c1c76b24d03a7e818eac2b5a9bd00a318d60` | 10434905 | m3-books.json |

M2b supplier PID 82630 used `.accounts/m2b/supplier1.json`, client PID 82720 used `.accounts/m2b/client.json`; both began empty and loaded only their own account. Supplier opened, checked tree inclusion and unshielded 1 QOR with the exact fee-adjusted balance increase. Client imported zero notes and returned DECRYPTION_FAILED. Historical non-anonymous memo is recorded as TICKET_INVALID, not accepted.

The M3 client shielded 2 QOR, privately paid business 1 QOR, retained its change, and posted the anonymous ticket. Business opened it and checked tree inclusion before owning its note. A holds the earlier 2-QOR M2 and 1-QOR M2b supplier outflows; B holds the incoming payment. Their receipt proofs are encrypted inside the entries.

The fresh auditor verified two blob SHA3 values against on-chain anchors, both hybrid signatures against the business's possession-proven on-chain ML-DSA key, entry chaining and the signed close. No B grant exists for the auditor; opening the business-only B self-envelope fails DECRYPTION_FAILED, exposed as NOT_GRANTED. Every audit chain read is pinned to 10434968.

## Not done / known problems

- M4 is not started: receipt Groth16 verification, receipt/root-history verdicts, reconciliation and D5 remain unbuilt. Real proof generation and receipt context binding do not prove those verdicts. The pool's Groth16 BN254 proofs are not post-quantum.
- C2 demonstrates script access to A and refusal of B, not completeness/correctness of bookkeeping, browser behaviour, metadata privacy or protection against an authorized auditor sharing plaintext/keys. C3–C6 remain NOT PROVEN.
- Payer anonymity is not provided: payer EVM addresses send private-send and memo transactions directly; no relay. The public memo board still exposes transaction timing, commitments and envelope size, despite zero recipient hints.
- No UI or 390px browser check, store upload, invoice-file flow, browser interception tests or QCAI contract audit was added in this scope.
- Preserve `.accounts/` privately: journals contain note secrets; `.accounts/m3/public/` holds ciphertexts, signed grants/self-copies and the auditor manifest. No plaintext entries are saved there by M3; period keys are persisted only in sealed envelopes. This is a local script handover, not the future store service. Do not publish the entire directory.
- Fresh processes load only their selected account through code; this is not an OS filesystem sandbox. Local script files are owner-readable, not a demonstrated browser storage design.
- Successful evidence commands refuse an existing output file. They are not free repeatable read-only demos. Held broadcasts must be resolved by stored hash, never rebuilt; preserve journals and cached ciphertexts before any future labelled run.
- Grants cannot be overwritten/revoked after reading; the owner can issue additional grants. B remains open; A entries are locked.
- Direct QoreSeal/QoreSign pins are 0.1.0/0.2.0. QoreSeal itself brings an internal QoreSign 0.1.0 dependency; SDK-key interoperability was tested live. No separate derivation or weaker-mode fallback is used.

## Conflicts with the PRD or the spikes

- Claude corrected its M2 brief: anonymous envelopes are required. Original non-anonymous evidence remains historical. Erratum, review, D11, C1 and S11 reflect the correction.
- Installed Gloam proofContext takes an object, rather than the PRD shorthand string. D12 records the deterministic adapter: kind payment, chain 9800, pool, verifier `quaestor|book|period|index`, expiresAt 0. No expiry is claimed. Context is tested against book/period/index changes.
- Explicit M3 instructions use batch context `quaestor:<book>:entry`, include notes, and defer reconciliation fields; these govern this implementation over PRD examples. Contract period IDs hash the UTF-8 date; epoch ordinals start at 1 and entry indices at 0. D12 records the encodings.
- S09/S16 and the actual contract close confirm active Diana precompiles. Official QoreChain EVM_PRECOMPILES.md specifies raw ML-DSA with empty context and no prehash; no inactive-precompile fallback is used. The S16 evidence's commit field is the then-HEAD 836aec0; its probe source was subsequently committed as 8479f98. M3 live source is exactly 5581269; the later change ef95514 only strengthens a test.
- The builder explicitly authorized M3 after A/B in this request, overriding the original M2 brief's stop-before-M3 boundary. No M4 work followed. `contracts/vendor/gloam/` is unchanged and no hosted Gloam services were used.

## Questions for Claude / the builder

No blocking question. Review this combined handoff before authorizing M4. In particular, review the deterministic context/period encodings and the distinction between auditor access/integrity (C2) and still-unbuilt receipt verdicts.
