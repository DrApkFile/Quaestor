# M1 review — Claude approval with required fixes

Review supplied by the builder on 2026-11-20. M1 is approved with the following three must-fixes before M2.

## Must fix

1. Make the fUSD test real.
   - broadcastNative must throw an error that keeps the chain’s code, codespace and rawLog (truncate rawLog to 500 chars; never include keys).
   - Record those fields in the fUSD evidence instead of CONVERSION_FAILED.
   - Fund business with 100 fUSD first: a hybrid bank MsgSend from deployer of denom erc20:0x97143B771D34ddb9130b807b135Ae675A5a963CA, amount 100000000. The faucet credited fUSD only to the deployer.
   - Rerun the conversion. Update REALITY_SPIKES S13 with the real result. Note that the first attempt ran with a 0 bank balance, so it was not a real test.
   - If conversion works, shield 50 fUSD with business and record it in evidence/m1b-fusd.json. Do not build further fUSD paths.
2. Fix the gas limit.
   - Replace the fixed GAS_LIMIT = 3_000_000n in the gateway with eth_estimateGas times 1.25, rounded up, capped at 3,000,000.
   - Keep checking the window budget against the gas limit you actually sign.
   - Run one shield of 1 QOR and record estimated gas, gas limit, gas used and fee paid in REALITY_SPIKES S06.
   - Note whether Diana charges a minimum of half the gas limit: M1’s 1,500,000 = 3,000,000 / 2 suggests it does.
3. Fix the docs.
   - In AGENTS.md, briefing/PRD.md and briefing/FAILURE_MODES.md, replace “Insert logs” with “the pool’s insertion events (Shielded, Transferred)”.
   - In docs/MILESTONES.md, change M1’s first item to say native QOR, with fUSD moved to M1b (conditional on S13). Tick what is done.
   - Copy this review into docs/reviews/M1-review.md under the heading “Must fix”, with a “Should fix (by M3)” section.

Commit each fix separately. Push when done. Write docs/handoff/M1-fixes.md and stop; do not start M2.

## Should fix (by M3)

- Add ESLint with typescript-eslint strict and no-explicit-any so pnpm gate’s lint step checks something.
- Cache the tree sync in included() instead of replaying from the deploy block every time.
