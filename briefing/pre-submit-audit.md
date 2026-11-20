# Pre-submit audit

Run from a **fresh clone** on a clean machine or container. Fix or disclose
every failed item.

## Rules and eligibility
- [ ] Every acceptance ID in `EVENT.md` has a passing test and an evidence file.
- [ ] Eligibility re-check script passes against the live system today.
- [ ] Submitting before the deadline in the correct time zone; any later
      commits are allowed by the rules (or none are made).
- [ ] Commit history meets the event's rules; prior work declared if required.
- [ ] Hosting rule met; judges can open the live URL without an invite.
- [ ] Every submission field answered; answers match README and UI.
- [ ] Required posts (demo, build log, social) published and linked.

## Build and code
- [ ] `<gate command>` passes from the clean clone with only the documented
      setup steps (and the README's setup actually works).
- [ ] No `any`, no empty `catch`, no `|| default` on values that matter.
- [ ] Config validated at startup; missing keys fail loudly.
- [ ] Dependencies pinned; lockfile committed.
- [ ] Secret scan over code, logs, evidence and outputs is clean.
- [ ] Adversarial, property and concurrency tests pass; test count in docs
      equals the count just observed.

## Honesty
- [ ] Every README/UI/submission claim appears as PROVEN in the claims ledger.
- [ ] Real / simplified / not built table is current.
- [ ] Demo data labelled as demo everywhere it appears.
- [ ] Evidence says what it does not prove; who paid / who used it is stated.
- [ ] Failed runs and false results remain on record.
- [ ] Known limitations are as precise as the features.
- [ ] Docs match code (no drift); every file named in docs exists.

## Judge experience
- [ ] 60-second judge path walked through by someone who hasn't seen it.
- [ ] "Verify it yourself" commands copy-paste and work.
- [ ] Guards a judge can attack live return the documented refusal codes.
- [ ] Demo video within length rules; required unedited segments intact.
- [ ] UI checked at 390px wide; empty, error and stale states render.
