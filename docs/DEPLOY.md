# Deploy Quaestor on Vercel

Run from the repository root. Root Directory must stay at the repository root: the serverless function is `api/qore-relay.ts`, and the frontend output is `apps/web/dist`.

1. Install Node 22+ and pnpm 9.15.0. Run `pnpm install --frozen-lockfile`, then `./scripts/vendor-gloam.sh`, `pnpm gate` and `pnpm -C apps/web build`.
2. Import this GitHub repository into Vercel. Keep Root Directory unset/root; choose Other if automatic framework detection conflicts with the overrides. Install command: `pnpm install --frozen-lockfile`. Build command: `./scripts/vendor-gloam.sh && pnpm -C apps/web build`. Output Directory: `apps/web/dist`. No application secrets or wallet environment variables are required.
3. Confirm the dashboard uses the checked-in `vercel.json`. Its first rewrite sends `/api/qore/:path*` to `/api/qore-relay?qorePath=:path*`; the function strictly decodes that routing parameter before applying the allowlist. `/app` and `/attack-lab` rewrite to `/index.html`. Vercel discovers the single root API function `api/qore-relay.ts`. Assets and lazy `/circuits/*` remain static files.
4. Check `.vercelignore` before upload. Never upload `.accounts`, `.env*`, private fixtures, plaintext entries/invoices, mnemonics, decrypted backups, note secrets or real signing keys. `apps/web/public/demo-auditor.json` is the explicitly public encrypted testnet-only auditor fixture; its published password is intentional. It grants demo read access and must never be used to receive valuable assets.
5. Deploy through the builder's Vercel account. After deployment, replace the local origin in JUDGES.md links with the actual deployment origin; do not invent a deployment URL.
6. Verify on the actual origin:

```sh
curl -I https://YOUR-ACTUAL-DEPLOYMENT/app
curl -I https://YOUR-ACTUAL-DEPLOYMENT/attack-lab
curl -i https://YOUR-ACTUAL-DEPLOYMENT/api/qore/rest/qorechain/pqc/v1/kem/qor1u5lhadlcp5wqf2h3yds2jclqc4q4dyacqugkqp
curl -i https://YOUR-ACTUAL-DEPLOYMENT/api/qore/rest/not-allowlisted
```

The registry query above uses the public demo auditor address. The valid registry query must reach the relay and return the registry response, not HTML. The invalid path must be refused, not rewritten to the SPA. Confirm Public check, Auditor and Attack lab, including reload/deep links and lazy circuit downloads, on that origin at 390px and desktop.

The relay only forwards the exact public REST/consensus paths and already-signed native transactions accepted by `apps/web/server/qorePolicy.ts`; EVM RPC stays direct. It does not log bodies or receive keys. CSP permits self and the three QoreChain hosts for connections, self-hosted scripts, `wasm-unsafe-eval` for snarkjs, and blob workers; it does not allow arbitrary API origins or `unsafe-eval`. Fonts/icons/circuits are self-hosted.

Platform references: [Vite functions](https://vercel.com/docs/frameworks/frontend/vite), [Node.js API functions](https://vercel.com/docs/functions/runtimes/node-js), [rewrite routing](https://vercel.com/docs/routing/rewrites). The local production build and preview relay are checked by the evidence run. A hosted Vercel deployment and its platform routing remain builder verification steps; no hosted deployment or key upload is claimed here.
