# Pre-submit checklist report

This applies every item in [briefing/pre-submit-audit.md](../briefing/pre-submit-audit.md). A passing repository build does not mean the external festival submission is complete. The current M8 brief explicitly requests a recording script and deploy readiness. The actual video, deployment and original external audit checks are unperformed and listed below. No submission, publication or deployment was performed by this task.

| Checklist item | Result / evidence |
|---|---|
| Every EVENT acceptance ID passing | Partial. A01 public repo and A02 MIT are checked in m8-repo.json; A03 credits are in README; A05 cover passes m8-cover.json; A06 addresses are listed; A08 commit history is retained; A09–A12 use the README requirement evidence; A15 AI_USAGE exists. A04 final video and external A07/A13/A14/A16/A17 checks are not independently verified here. A18's repository-build part is checked separately below. |
| Live eligibility re-check today | Public repository/license metadata only: evidence/m8-repo.json. No festival eligibility re-check endpoint/session is available; project-page “Check again” remains for the builder. |
| Deadline / time zone | Deadline 2 Dec 2026 23:59 UTC; internal 20:00 UTC. This work precedes it. No permission for post-deadline commits is inferred. |
| Event commit history | Small commits since 20 Nov; no squash/rewrite. See git log and the milestone handoffs. |
| Hosting rule / unauthenticated URL | Not done. Local production-preview judge links work; no hosted URL is claimed. Deploy steps: DEPLOY.md. |
| Submission fields | Technical text, README, cover and script are supplied. Builder must paste fields, choose country, confirm registration and verify kits in the project UI. |
| Required posts | Not published; builder action. |
| Fresh clone documented setup → gate → build | The exact run is recorded in evidence/m8-presubmit.txt. It is a new local clone without account fixtures, using this machine's Node/pnpm/Foundry and package cache; not a claim of a pristine operating system. |
| No any / empty catch / critical silent default | Strict type-checked ESLint covers our TS source, including no-explicit-any/no-floating-promises. The known, explicitly chosen network defaults in the inherited template are not missing-secret fallbacks. Vendor source remains unmodified and is excluded from our lint. |
| Validated config / missing keys fail | Zod chain/config, account/vault and blob boundaries; wrapper/window/vault tests. Read-only judge paths use no business private keys. |
| Pinned dependencies / committed lockfile | Frozen-lockfile install; pinned workspace dependencies. Optional local OCR versions are retained in scripts/ocr-requirements.txt. |
| Secret scan code/log/evidence/output | evidence/m8-secret-scan.json checks exact local secret values/encodings in tracked/nonignored files and new commit diffs; evidence/m7b-image-secret-scan.json binds OCR plus visible DOM results to image hashes. Does not establish universal secret detection. |
| Adversarial / concurrency tests and actual count | See the exact gate output in evidence/m8-presubmit.txt; no counts are invented or doubled because Forge is invoked twice. |
| README/UI/submission claims PROVEN | README sections are bound to PROVEN ledger entries, code/tests/evidence and observed hashes by claims:check, with refusal tests. UI positive/negative results have live browser evidence. Project-page content is not updated by this task. Human review still judges the meaning of claim mappings. |
| Real / simplified / unbuilt current | README status table and CLAIMS limitations distinguish proven native QOR, script-only fUSD, daily demo periods, declared later openings and unperformed external work. |
| Demo labels | Fictional counterparties end in (demo); daily mode is labelled demo-scale; testnet-only public auditor is explicitly labelled. First Northwind retained as “superseded: canary content”. |
| Evidence limits / payer attribution | C1/C5/C6 and threat model preserve payer metadata, lower-bound holdings, declared openings and exercised-flow limits; setup funding/cash-outs have separate receipts. |
| Failed runs retained | The m8-privacy network-change failure and earlier M4–M7 failures remain in evidence. Resumption uses encrypted checkpoints and original hashes. |
| Precise known limitations | THREAT_MODEL, CLAIMS, README and handoff; Groth16 is classical, no complete-income or counterparty-identity claim, no merging notes, permanent grants, exposed metadata and legacy disclosure. |
| Docs/code/files consistent | Claims check validates mapped source/evidence/test names and README text; judge links reference current metadata/evidence. Build and browser runs supply the behavioral checks. |
| Independent 60-second judge walkthrough | Automated empty-browser auditor/public checks pass; an uninvolved human walkthrough has not been performed. The “60 seconds” is click-path guidance; chain reads/circuit downloads can take longer. |
| Copy-paste verification commands | Fresh clone exercises frozen install, circuit and pinned forge-std setup, gate and production build. Judge path uses the same production preview/relay handler as Playwright. |
| Live attack guards and refusal codes | Read-only attack lab's four results are checked live; fresh auditor refusal of C and B-only isolation are checked. No new transactions are sent by those audit pages. |
| Final video length / required segments | Not recorded. VIDEO_SCRIPT.md totals 2:45; builder must record real interactions, label omitted waiting time and run ffprobe before submission. |
| UI 390px / empty / error / stale | M7/M7b captures check every requested screen at 390 and 1440, with request errors failing the run. Existing empty/UNKNOWN/refusal states have source/unit coverage; exhaustive visual testing of every stale/error combination is not claimed. |

The planned two-stage QCAI audit is also unperformed; no report is claimed. It remains external follow-up in ROADMAP.md. The builder must finish hosting/video/project-page and any required audit/social/eligibility actions before submission.
