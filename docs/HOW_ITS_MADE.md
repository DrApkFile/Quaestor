# How it's made

Quaestor combines private payments with books an auditor can open one period at a time. A Vite/React browser holds the account vault, notes and period keys locally. Our deployment of Gloam's MIT-licensed shielded pool runs on QoreChain Diana. Ownerless BlobBoard events store encrypted records; Books contracts anchor their ciphertext hashes. An allowlisted Vercel relay carries public queries and signed transactions around Diana's REST/consensus CORS restrictions.

QoreSeal seals anonymous ML-KEM-1024 + X25519 tickets and period grants to registry-verified recipients. QoreSign signs entries and closes with ML-DSA-87 binding. The QoreChain SDK handles hybrid native transactions, KEM/ML-DSA registration and EVM windows; contracts use possession-proven pqcKeyStatus and pqcVerify. The window helper came from create-qorechain-dapp's Foundry template.

The hard parts changed the design. A third-party Groth16 pool needed careful EVM-window budgeting and nonce ordering. Diana's 50% minimum gas charge made fixed oversized limits expensive. Audits rebuild insertion history beyond the pool's last 100 roots. Review exposed recipient-linkable ticket hints, so envelopes became anonymous. Guessable plaintext-hash anchors became ciphertext anchors; historical disclosure remains documented. Notes cannot be merged: closes select at most four covering notes or refuse. Browser interception checks secrets and plaintext canaries on a separate Privacy test (demo) book; the Northwind judge book contains readable fictional entries.

Holdings checks establish a scoped lower bound, not complete income. Groth16 remains classical. Claude planned/reviewed, Codex built, and the builder decided scope and corrections.
