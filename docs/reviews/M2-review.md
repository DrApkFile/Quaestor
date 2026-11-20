# M2 review — approved with a required correction

Supplied by the builder following Claude's review.

## Must fix

Anonymous envelopes are required; non-anonymous hints let anyone with the payee’s public key link payee to payment (Claude’s error, found in M2 review).

- Seal hybrid tickets with anonymous: true and two recipients; reject non-anonymous tickets.
- Skip NOT_A_RECIPIENT and DECRYPTION_FAILED silently when scanning.
- Prove that an observer with every registered ML-KEM public key cannot identify recipients from zero hints.
- Run pnpm evidence --m2 as a new labelled anonymous run, evidence/m2b-ticket-anonymous.json; keep old evidence. Pay supplier1 1 QOR from the business's change or shield 2 first. Record client DECRYPTION_FAILED.
- Update the M2 brief, C1's payer-anonymity exclusion, and roadmap relay work.

## Should fix

Preserve JOURNAL_LOCKED and other non-network receive errors as their own codes.

## Due by M3 from M1 review

- ESLint 9 flat config, typescript-eslint strict-type-checked, no-explicit-any and no-floating-promises; lint scripts in every TypeScript package.
- Cache createTreeSync per gateway; sync incrementally and verify currentRoot at a pinned block.

The builder also authorized M3 sealed books, grants and Books.sol after these fixes. Do not start M4.
