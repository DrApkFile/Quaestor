# M10 uninterrupted signup — first attempt timed out

Do not run before the builder explicitly says the faucet is ready, after **24 November 2026, 09:40 Africa/Lagos (08:40 UTC)**. Time alone is insufficient. The builder subsequently said “go” on 25 November. The attempt at 03:51:53–04:12:40 UTC created and backed up its account, then timed out waiting for manual faucet funding. See `evidence/m10-fresh-signup.json` and `docs/handoff/M10b.md`. The existing session is consumed; do not delete it or restore it into an uninterrupted-success claim. The original prepared procedure follows; a future fresh trial needs separate authorization and a distinct preserved attempt identity.

After that signal, run on the deployed M10 build:

```
QUAESTOR_M10_FAUCET_READY=builder-confirmed pnpm evidence --m10-fresh-signup
```

The flag records an actual builder signal; never set it speculatively. The runner checks the time, requires the deployed origin, creates an empty browser context and refuses an existing M10 signup session. There is no resume mode. It creates an account, downloads an encrypted backup, prints the public funding address and writes `evidence/m10-funding-needed.json`. The builder claims the faucet manually. No faucet requests or deployer funding are automated. Keep the run uninterrupted. If the faucet refuses, tell Codex immediately; create the ignored marker `.accounts/m10-browser/faucet-refused` to stop polling within ten seconds and record refusal. Funding timeout is twenty minutes and does not trigger a fallback.

After funding, the same context activates, deposits 2 QOR and privately pays 0.5 QOR to supplier1 (`qor1uz3zu3883m06vcguymnkxema9uantwxn8dmmw2`). A separate empty context restores supplier1's existing encrypted backup and checks receipt of that exact commitment. The runner accepts the app's transaction-window confirmations, intercepts requests/responses and captures screens at 390/1440 with axe. It retains failure reports and keeps backups/comparison secrets only in ignored `.accounts/`. Do not copy those files into evidence.

A passing browser result still requires `pnpm evidence --m10-secret-scan`, receipt/cost rereads and a scoped claim review. Use actual elapsed times, distinguish the manual faucet wait and screenshot/backup overhead, and compute fees from observed native and EVM receipts. Only then add the uninterrupted run to CLAIMS C5/C11 and update JUDGES “Try it yourself” with real time/cost. Keep every M9 resumed-run and failed-attempt record. A failure must not be relabelled as an uninterrupted success by restoring the account.

UX evidence can be reproduced independently with `pnpm evidence --m10-screens`. Default origin/phase: deployed/before. For an updated local production preview, set `QUAESTOR_M9_ORIGIN=http://127.0.0.1:4173 QUAESTOR_M10_PHASE=after`; run `pnpm -C apps/web exec vite preview --host 127.0.0.1 --port 4173` separately. This readback sends no transactions and exercises existing encrypted signup and populated demo-business backups. It is not the fresh signup.
