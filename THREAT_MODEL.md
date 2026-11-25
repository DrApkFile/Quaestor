# Threat model

Quaestor has script and scoped browser evidence on QoreChain Diana. Request interception establishes only the exercised flows in CLAIMS C5; it does not establish universal browser confidentiality.

We defend payment-ticket and period-key payload confidentiality with QoreSeal hybrid ML-KEM-1024 + X25519 and anonymous recipient envelopes. Entries use symmetric period keys sealed through that hybrid mechanism. The intended protection includes harvest-now/decrypt-after-Q-Day attacks, assuming ML-KEM and the symmetric cryptography remain secure and endpoints keep their keys secret. The business grants one period at a time. Signed ciphertext hashes, ordered previous hashes and immutable on-chain anchors protect the integrity of the anchored entries.

The following information is public or outside that protection:

- The payer's EVM address originates private sends and memo posts; there is no relay.
- Memo transaction timing and envelope size are public.
- Grant anchors reveal the auditor EVM address and period identifier.
- Per-period entry counts and anchor timing are public. Hashed demo date labels can be guessed.
- Deposits and cash-outs expose their public chain transactions, addresses and amounts.
- An authorized auditor can copy and share any plaintext or key it reads. Period access cannot be revoked retroactively.
- The pool's Groth16/BN254 proofs are not post-quantum. Hybrid tickets do not make the payment proof system post-quantum.
- Colluding payers and businesses can hide income, and funds kept outside the books are not detected. Holdings coverage is a lower-bound check against declared books, not a completeness audit or proof of income history.
- Later-period closes contain an opening balance declared and signed by the business (D17). A period-only auditor verifies that declaration, the preceding close anchor and the holdings calculation without another period's key. This does not establish correctness of the declared opening balance for periods after the first.

Compromised devices, leaked mnemonics, malicious key backups and an auditor sharing credentials break the corresponding access boundary. Public signatures and anchors do not prove a counterparty's real-world identity. Missing or unverifiable data produces UNKNOWN, never a green result.

M4 legacy disclosure: the opening records were anchored by plaintext SHA3. Their public book ID, near-registration timestamp and small demo balances make dictionary attacks practical. Treat the M4 opening balances as disclosed (demo). Close records include proof bytes and are not similarly guessable. New records anchor ciphertext SHA3. Historical M4 opening/close compatibility mappings expose the link between the old anchor and ciphertext, signed by the owner; they do not recover confidentiality already lost to plaintext hashing. The auditor verifies that link again after decryption.

Exact modes, contexts, dependency versions and measured close gas: [PQ parameters](docs/PQ_PARAMETERS.md).
