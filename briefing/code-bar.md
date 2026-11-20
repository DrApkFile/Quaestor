# The code bar

Read this for phase 8 and again in the pre-submit audit. Each rule comes from
a pattern seen in the strongest studied code, with the reason it matters.

## 1. Code that explains itself

- **No comments, enforced by a lint rule** with inline disables turned off
  (`noInlineConfig: true`). The rule's message: rename or split the code so
  it explains itself. Comments drift; names are checked by every reader.
- Names carry intent: `requireCurrentPlan`, `assertNotBlocked`, `onlyMatch`,
  `shouldApplyAutomatically`.
- Magic numbers become named constants, with tuning constants in one file.
- Small files and components (split past ~180 lines). A 900-line file is a
  smell even in a well-planned project.

## 2. Types and schemas

- Strict mode; no `any`.
- Strict schemas everywhere input crosses a boundary (Zod `.strict()`, JSON
  schema `additionalProperties: false`), exact regexes, literals for fixed
  values (chain IDs), big integers as BigInt.
- Derive types from a single `as const` array so the list and the type cannot
  drift. Use `as const satisfies` / `Record<Union, …>` so the compiler forces
  full coverage.
- Results as **discriminated unions** (`"plan" | "infeasible"`); an
  infeasible result names what blocks it.
- `readonly` interfaces in the core.
- Money as integer base units (strings validated by `^(0|[1-9]\d*)$`, BigInt
  arithmetic, underflow throws).
- Config validated at startup; no `process.env.X || ''`.

## 3. Architecture

- **A pure core** (`engine/`, `packages/core`) with no network, no framework
  imports, injected dependencies (store, gateway, keys, `now`). The same code
  runs in production and in tests.
- Strict layers: mutations never call the network; actions change state only
  through mutations.
- Write the result, its revision, status and an activity row **in one
  transaction**.
- **Separate state machines** for work, money and external actions, mirrored
  as database `CHECK` constraints. Financial state defaults to `unknown`.
  `UNKNOWN` is a first-class state with **no resubmit edge**.
- **Make dangerous things impossible to express**: allow-listed methods (and
  a test that reflects over the prototype to prove nothing else exists),
  `UNIQUE` constraints for nonces and request IDs inside the transaction.
- Append-only evidence; erasure by tombstone that keeps the digest.

## 4. Guards and errors

- Guards as small named `require*` / `assert*` functions on every write path,
  re-reading state at write time (stale revision, frozen workspace).
- Typed errors (`StaleRevisionError`, `ConflictError` with a `kind`).
- **Closed set of error codes** with `{message, retryable, nextAction}` per
  code, typed so every code must be handled. Agents and machines can act on
  them.
- **User-facing messages** that say whether anything changed ("Nothing was
  changed. Reload and try again.").
- **Fail closed.** Three-valued verdicts (PASS / FAIL / INCONCLUSIVE):
  unknown is never success, and your own failures are never blamed on the
  thing you are testing.

## 5. Model output

- Prefer structured output with a strict schema, and still parse the payload
  as `unknown`.
- Unknown enum values map to `"other"`; numbers like confidence are clamped.
- **Verify against the source**: a quoted span must appear verbatim (after
  normalizing whitespace and case), with minimum length.
- Automatic application only above a named threshold **and** after
  verification, decided in one named function.
- Prompts say "never paraphrase"; code checks it anyway.
- **Refuse rather than repair.** Never regex-patch model output into shape.

## 6. Matching and ambiguity

- `onlyMatch`: return a result only when **exactly one** candidate matches;
  two is no match.
- Try strong signals first (exact time in the right time zone), then weaker
  ones; short or unsupported hints return `null`.
- Ambiguity goes to a human or a named refusal, never a guess.

## 7. Security details

- Unbiased random codes (alphabet size divides 256, or rejection sampling),
  ~128 bits of entropy, store only the hash, redact the code from stored
  messages.
- Signatures over every signed artifact; round-trip, tamper and wrong-key
  tests for each.
- SSRF: DNS pinned per connection, private ranges refused, signed requests
  never follow redirects.
- Secrets hashed or redacted at any depth; a test scans every output for
  them.
- Dependencies pinned exactly, lockfile frozen, CI actions pinned by SHA.

## 8. Tests

- **Named as behaviour**: "rejects a delivery replayed after the tolerance
  window on either side", "reports a missing title as null rather than
  inventing one".
- **Acceptance IDs in titles** (`A07 …`) so `test -t A07` runs a rule.
- **Property tests** over thousands of random instances; collect every
  failure with its seed, then assert the list is empty.
- **Determinism tests** (reverse every input, expect identical output).
- **Brute-force oracle** for any optimizer or solver.
- **`tests/adversarial/`** that attack the guards; **test seams** (e.g.
  `transform`/`rewriteHeaders` hooks) so tests can play a malicious relay.
- **Concurrency tests** against the real database (`Promise.all` races on a
  spend).
- **Parity tests** when the rubric asks for equal depth across categories.
- Live/integration suites separated from unit suites; fakes only at the
  edges in end-to-end tests.
- When replacing a library default, a test fails if someone changes it back.

## 9. Frontend

- Many small components grouped by area.
- Dedicated components for the states people skip: stale, frozen, empty,
  error boundary, retry, "needs a human".
- Show proof status in the product ("proven optimal" vs "best found, gap X"),
  and `—` instead of a guessed number.
- Check at 390px wide.

## 10. Commits

- Behavioural subject lines.
- Bodies that record reality: what was wrong, what is true now, what didn't
  change, how it was verified, test count ("122, was 115") and any live
  numbers with dates.
- Docs-only commits to bring claims back in line with code are normal; drift
  is a bug.
- Commit as you go, honestly. Do not rewrite or bulk-replay history to make
  it look incremental, and check the event's history rules.
