# Deploy Quaestor on Vercel

Run from the repository root. Root Directory must stay at the repository root: the serverless function is `api/qore-relay.ts`, and the frontend output is `apps/web/dist`.

1. Install Node 22.12+ and pnpm 9.15.0. Run `pnpm install --frozen-lockfile`, then `./scripts/vendor-gloam.sh`, `pnpm -C contracts forge-std`, `pnpm gate` and `pnpm -C apps/web build`.
2. Import this GitHub repository into Vercel. Keep Root Directory unset/root; choose Other if automatic framework detection conflicts with the overrides. Install command: `pnpm install --frozen-lockfile`. Build command: `./scripts/vendor-gloam.sh && pnpm -C apps/web build`. Output Directory: `apps/web/dist`. No application secrets or wallet environment variables are required.
3. Confirm the dashboard uses the checked-in `vercel.json`. Its first rewrite sends `/api/qore/:path*` to `/api/qore-relay?qorePath=:path*`; the function strictly decodes that routing parameter before applying the allowlist. `/app` and `/attack-lab` rewrite to `/index.html`. Vercel discovers the single root API function `api/qore-relay.ts`. Assets and lazy `/circuits/*` remain static files.
4. Check `.vercelignore` before upload. Never upload `.accounts`, `.env*`, private fixtures, plaintext entries/invoices, mnemonics, decrypted backups, note secrets or real signing keys. `apps/web/public/demo-auditor.json` is the explicitly public encrypted testnet-only auditor fixture; its published password is intentional. It grants demo read access and must never be used to receive valuable assets.
5. Deploy through the builder's Vercel account. After deployment, replace the local origin in JUDGES.md links with the actual deployment origin; do not invent a deployment URL.
6. Verify on the actual origin:

```sh
curl -I https://use-quaestor.vercel.app/app
curl -I https://use-quaestor.vercel.app/attack-lab
curl -i https://use-quaestor.vercel.app/api/qore/rest/qorechain/pqc/v1/kem/qor1u5lhadlcp5wqf2h3yds2jclqc4q4dyacqugkqp
curl -i https://use-quaestor.vercel.app/api/qore/rest/not-allowlisted
```

The registry query above uses the public demo auditor address. The valid registry query must reach the relay and return the registry response, not HTML. The invalid path must be refused, not rewritten to the SPA. Confirm Public check, Auditor and Attack lab, including reload/deep links and lazy circuit downloads, on that origin at 390px and desktop.

The relay only forwards the exact public REST/consensus paths and already-signed native transactions accepted by `apps/web/server/qorePolicy.ts`; EVM RPC stays direct. It does not log bodies or receive keys. CSP permits self and the three QoreChain hosts for connections, self-hosted scripts, `wasm-unsafe-eval` for snarkjs, and blob workers; it does not allow arbitrary API origins or `unsafe-eval`. Fonts/icons/circuits are self-hosted.

Platform references: [Vite functions](https://vercel.com/docs/frameworks/frontend/vite), [Node.js API functions](https://vercel.com/docs/functions/runtimes/node-js), [rewrite routing](https://vercel.com/docs/routing/rewrites). The local production build and preview relay are checked by the evidence run. A hosted Vercel deployment and its platform routing remain builder verification steps; no hosted deployment or key upload is claimed here.

M8 judge content uses `pnpm evidence --m7b`, after `pnpm evidence --m8-privacy` has completed on the separate Privacy test (demo) book. The current judge book is named in `public/m7-demo.json` and JUDGES.md; the original Northwind run is retained as “superseded: canary content”. Screenshots of the current fictional book are intentionally unmasked. To repeat their local visible-text/OCR secret scan with the builder's private fixtures, install the isolated tool environment with `uv venv .accounts/m8-ocr` and `uv pip install --python .accounts/m8-ocr/bin/python -r scripts/ocr-requirements.txt`, then run `pnpm evidence --m7b`. Never upload `.accounts`, including that environment or scan inputs. This tooling is not part of the deployed application.

`pnpm evidence --m8-cover` renders the original local cover artwork without network requests. `pnpm evidence --m8-presubmit` clones the committed local HEAD into a fresh temporary directory, installs the frozen lockfile, prepares circuits and pinned forge-std, verifies the vendor tree is unchanged, runs the gate and builds production. Its full output is `evidence/m8-presubmit.txt`. It reuses installed machine tools/package caches, but copies no private accounts. External hosting, the final recorded video and project-page actions remain the builder's submission steps; see `docs/PRESUBMIT.md`.

The mutating legacy `pnpm evidence --m7` entry point is retired: it refuses with `M7_RUN_SUPERSEDED_USE_M7B_OR_M8_PRIVACY` to prevent stale canary fixtures being reused as the judge run. Historical M7 commands/results remain unchanged in the handoff. M7b requires a passing, separately labelled Privacy test run before copying its encrypted state.

M9 deployment verification: https://use-quaestor.vercel.app serves the deployed app and lab. `pnpm evidence --m9-deploy` records all four curl checks and CSP/security headers; `pnpm evidence --m9-judge` with `QUAESTOR_M9_PHASE=after` exercises the live judge path. Vercel supplies both `qorePath` and wildcard `path` routing metadata on the original public URL. The relay preserves that public pathname, then applies the unchanged upstream allowlist. Rejected requests return only closed diagnostic categories, without query values or bodies. The first parsed-metadata-only fix did not repair the live rewrite; both failed deployment reports are retained. See [Vercel's rewrite parameter examples](https://vercel.com/docs/routing/rewrites).
