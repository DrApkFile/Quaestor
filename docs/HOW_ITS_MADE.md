# How it's made

Quaestor combines private payments with books an auditor can open one period at a time. A Vite/React browser keeps keys and notes locally. Our deployment of Gloam's MIT-licensed shielded pool runs on QoreChain Diana. BlobBoard events store ciphertext; Books anchors ciphertext hashes. An allowlisted Vercel relay handles public queries and signed transactions around REST/consensus CORS restrictions.

QoreSeal seals anonymous ML-KEM-1024 + X25519 tickets and grants to registry-verified recipients. QoreSign binds signed entries and closes. The QoreChain SDK handles key registration, hybrid native transactions and EVM windows; Books requires possession-proven pqcKeyStatus and pqcVerify. The window helper came from create-qorechain-dapp.

One activation button sequences signing-key registration, encryption-key registration and payment-card publication, skipping chain-confirmed steps. Keys are never derived from wallet signatures. A public demo auditor opens Northwind with one click; readable verdicts show why a payment matches and why another period stays sealed. Route imports defer heavy cryptography; circuits download when needed.

Review changed the implementation: recipient-linkable hints became anonymous envelopes; guessable plaintext anchors became ciphertext anchors, with historical disclosure documented. Gas uses estimates and signed window budgets. Audits rebuild full insertion history. Notes cannot merge: closes select at most four covering notes or refuse. Separate browser canaries and visible-image scans check known secrets.

Holdings checks prove a scoped lower bound, not complete income. Groth16 remains classical. Claude planned/reviewed, Codex built, and the builder chose scope and funded test accounts.
