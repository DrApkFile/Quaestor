# How it's made

Copy of the project page field. Update at every milestone, then paste into the form.

---

Quaestor is a web app for private business payments on QoreChain testnet, with books sealed by post-quantum encryption.

**Plan:**
- **Private rail.** We deploy Gloam's open-source shielded pool (MIT) ourselves on qorechain-diana and drive it with its SDK.
- **Post-quantum tickets.** The note a payee needs to claim a payment is sealed with QoreSeal (ML-KEM-1024) to their key in QoreChain's registry, replacing Gloam's classical P-256 encryption.
- **Sealed books.** Every payment writes a book entry, encrypted in the browser under that quarter's key, signed with ML-DSA-87 (QoreSign) and anchored on QoreChain.
- **Audit by quarter.** The business grants its auditor one quarter's key. The auditor checks each entry against the pool using zero-knowledge receipts.

**Expected hard parts:** running a third-party Groth16 pool under QoreChain's EVM windows, proving receipts against the pool's history, and keeping every secret in the browser.

Built with Claude (planning and review) and Codex (coding). Not affiliated with Gloam. Updated at each milestone.
