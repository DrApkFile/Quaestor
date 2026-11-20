# QoreSeal (ML-KEM-1024 encryption to QoreChain accounts)

Researched: 2026-11-20
Primary sources (read in the cloned repo github.com/qorechain/qoreseal @ main, 20 Nov): README.md, spec/qoreseal-v1.md, docs/quickstart.md, docs/guides/{encrypt-to-an-address, multi-recipient-and-auditors, private-sidechain-epochs, key-backup}.md, packages/ts/src/{envelope,group,kem,index}.ts. npm `@qorechain/qoreseal@0.1.0` (latest).

## What it actually is
A library (TS, Go native; Rust/Swift/Kotlin/Python wrap Rust) that encrypts a payload once with AES-256-GCM and wraps the data key per recipient with ML-KEM-1024 (+ X25519 in default hybrid mode). Recipients are found by address via the chain's KEM key registry. Version 0.1.0, external review pending before 1.0.

## Core concepts you need before building
- **Modes:** `hybrid` (default; needs on-chain ML-KEM key + a recipient card carrying X25519) and `mlkem` (on-chain key only). `mlkem` must be passed explicitly.
- **Context binding:** HKDF info `"qorechain-kem-v1|" + chainId + "|" + purpose`. Wrong chainId/purpose → cannot open. Purposes: letters, digits, `. _ : / -`. Quaestor uses `quaestor:ticket`, `quaestor:<book>:quarter-key` and `quaestor:<book>:entry`.
- **AAD:** authenticated, not encrypted; recipient must pass the same bytes. Bind tickets to `chainId|pool|paymentCommitment`, entries to `book|quarter|entryIndex`.
- **Envelope size:** `56 + 1664·n + plaintext` (hybrid), `56 + 1632·n + plaintext` (mlkem). Spike S01 measured 5,093 B for 3 recipients + 45 B epoch-key payload = formula. A ticket to 2 recipients with a ~400 B note package ≈ 3.8 KB, under GloamPayMemo's 8,192 B limit (confirm on chain: S11).
- **Hints (the audit depends on this):** non-anonymous envelopes carry per entry `hint = SHA3-256("qorechain-qoreseal-hint-v1" || salt || mlkemPublicKey)[0..16]`. Anyone who knows a candidate's ML-KEM public key (on chain = public) can test membership. `parseEnvelope()` returns `salt`, `entries[].hint`, `anonymous`; `recipientHint(salt, pk)` is exported. With `anonymous: true` hints are zero → audit impossible (`UNAUDITABLE_ANONYMOUS`).
- **Envelopes are not signed.** Anyone can encrypt to an address. Sign manifests with QoreSign `signMessage` (ML-DSA-87).
- **Recipient card:** ~6.7 KB signed JSON (mostly ML-DSA-87 signature) holding the X25519 key; verified against both on-chain keys; stops verifying when the account registers a different ML-KEM key. Forged/stale card → worst case is ML-KEM-only strength.
- **EpochKeyManager:** one 32-byte key per epoch; **every** add/remove starts a new epoch; `distribution()` seals the current epoch key to current members (purpose you choose); `removeMember` returns `{epoch, envelope, members}`; `exportKeys()` returns all epoch keys (store encrypted to the creator's own key + recovery key); restore with `history`.
- **PrivateBatchCodec / sealBatch / openBatch:** payload sealed under an epoch key with `ciphertextCommitment` (SHA3-256 of blob) and salted `plaintextCommitment`. Use for posts.
- **Key derivation:** `deriveSealKeys({ mnemonic, index })`. Key loss = data loss.
- **Registry messages:** `buildRegisterKemKeyMessage({ sender, mlkemPublicKey })`, `buildRemoveKemKeyMessage`; must be hybrid-signed (QoreSign `signHybrid`) by an account that already has an ML-DSA-87 key. Errors codespace `pqc`, codes 250–254, `describeKemRegistryError`.
- **REST:** `GET /qorechain/pqc/v1/kem/{address}` (ML-KEM key), `GET /qorechain/pqc/v1/account/{address}` (ML-DSA key). Network helpers in `@qorechain/qoreseal/network`: `fetchKemKey`, `resolveRecipient`, `sealToAddresses`.

## Minimal working shape (verified offline in S01)
```ts
const mgr = new EpochKeyManager({ chainId, purpose, members: { [addr]: recipient } });
const env = mgr.distribution();
const parsed = parseEnvelope(env);
const isIn = parsed.entries.some(e => equal(e.hint, recipientHint(parsed.salt, memberMlkemPk)));
const k = openEpochKey({ chainId, purpose, envelope: env, keys: myKeys }); // throws NOT_A_RECIPIENT otherwise
```

## Defaults and ordering that matter
- Default is hybrid: members need a card or `setMember` throws `RECIPIENT_NEEDS_X25519`. Fetch and verify cards first; a payee or auditor without a valid card is refused with `CARD_INVALID`, never silently downgraded to `mlkem`.
- `removeMember` on the last member returns `envelope: null`.
- Max 1024 recipients per envelope.

## Known gotchas / traps
- **Do not derive reader keys from a wallet signature.** QoreX exposes no KEM/decrypt API (checked qorex-integrations types, 20 Nov). Deriving ML-KEM keys from an ECDSA `personal_sign` output would let a quantum attacker who recovers the ECDSA key re-derive the reader's KEM secret — the whole PQ claim collapses. Generate seal keys from fresh randomness (or a separate mnemonic) in the browser, back them up, register the public key on chain.
- The README says TS package "coming to npm"; it is on npm as 0.1.0 (checked 20 Nov). Pin exactly `0.1.0`.
- Hint check proves entries for expected keys exist; combined with `entries.length === expected.length` it proves the exact set (16-byte hint collisions negligible). It does **not** prove each entry wraps the same epoch key — readers check that themselves by opening.

## Unverified: confirm with a reality spike
- Card JSON fetched from our store verifies with `verifyRecipientCard` against live Diana keys (S10).
- `sealToAddresses` / `fetchKemKey` work in the browser against api-testnet (CORS!) — Quantum Dice README warns balance reads hit CORS; may need a proxy (S08).

## Explicitly out of scope
Anonymous-mode tickets (P1 at most: they make receipt discovery slower), per-recipient redaction, ZK, key escrow.
