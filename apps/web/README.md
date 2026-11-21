# Web foundations (M5)

Normal Vite/React app, testnet only; no PWA or store server. Run `pnpm -C apps/web dev` from the workspace. Production build: `pnpm -C apps/web build` after self-hosted circuits are available from `./scripts/vendor-gloam.sh`.

Account creates/restores an encrypted IndexedDB vault and requires an encrypted backup download before transactions. Onboarding reads actual funding, possession-proven signing-key, KEM-key and verified-card state from Diana. Public check reads anchors and hashes without decryption. Auditor opens the M4 honest demo book from on-chain blobs, verifying entries and holdings locally.

`pnpm evidence --m5-web` runs the production-preview Playwright check with a local encrypted auditor fixture. It needs `.accounts/auditor.json`; neither the fixture nor its passphrase is deployed. `pnpm gate` runs unit tests without a live account. The allowlisted relay forwards public queries/already-signed transactions only, never keys or request logs.

Pay and book-writing screens remain M6. The app has not been deployed to Vercel; deployment configuration is in the workspace root.
