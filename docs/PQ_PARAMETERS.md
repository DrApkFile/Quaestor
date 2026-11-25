# Post-quantum parameters

Inspected 25 Nov 2026. From M12, application records and newly generated Books close signatures use hedged signing; verification and encryption are unchanged. ML-DSA-87 and ML-KEM-1024 both target NIST category 5 ([FIPS 204 §3](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.204.pdf), [FIPS 203 §8](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.203.pdf)). Books should remain confidential and verifiable for decades: these parameters support the tagline's long-term goal, not a promise about future cryptanalysis or the rest of the chain.

## Installed code and settings

[Source evidence](../evidence/m11-pq-settings.json) records resolved package paths, exact versions, full-file SHA-256 and numbered excerpts. Paths below are dependency files relative to their package root; line numbers refer to installed JavaScript. Reproduce with `pnpm evidence --m11-pq-settings` after frozen install. No private input is used.

Resolved versions: SDK 0.14.0; pqc 0.2.3; application QoreSign 0.2.0; QoreSeal 0.1.0; QoreSeal's **transitive QoreSign 0.1.0**; underlying `@noble/post-quantum` 0.7.1. The resolved manifests are identified in the evidence's `versions` array. QoreSeal `package.json:76–78` pins noble 0.7.1, pqc 0.2.3 and QoreSign 0.1.0. The two QoreSign versions have the same relevant signing defaults.

| Signature | Implementation and caller | ML-DSA mode | Randomness | FIPS context | Message domain / dependency citation |
|---|---|---|---|---|---|
| Books close signature | SDK pqcSign → pqc mldsa87; `apps/web/src/business/close.ts` → `closeSignature.ts` | Pure ML-DSA-87, signing an application digest; not HashML-DSA | Hedged (`hedged: true`) from M12; pre-M12 deterministic, both valid | Empty bytes | `@qorechain/sdk/dist/index.js:18428–18434`; `@qorechain/pqc/src/index.js:59–64`; exact close digest below |
| QoreSign entry/opening/grant/close records | QoreSign 0.2.0 signMessage; `packages/core/src/signing.ts:26` | Pure ML-DSA-87; hashing the record in our application does not select HashML-DSA | Hedged (`hedged: true`) from M12; pre-M12 deterministic, both valid | Empty bytes | `dist/chunk-CC36VDKC.js:789–826`: message prefix `qorechain-msg-v1\|qorechain-diana\|` followed by data; `:418–420` forwards hedged only if explicitly true |
| Hybrid native transactions | SDK signHybridEth, via EthNativeSigner | Pure ML-DSA-87 | Deterministic (no opts passed) | Empty bytes | SDK `dist/index.js:22109–22147`, then `:18428–18434`; `:18702–18749` defines v1/v2 message serialization |
| Recipient cards | QoreSeal 0.1.0 signRecipientCard → QoreSign 0.1.0 signMessage; `packages/chain/src/tickets/cardCodec.ts:56` | Pure ML-DSA-87 | Deterministic (hedged omitted) | Empty bytes | QoreSeal `dist/chunk-NSORPEVS.js:48–59,74–83`; transitive QoreSign `dist/chunk-GMJLZUVP.js:747–787,418–420`: same `qorechain-msg-v1\|qorechain-diana\|` message prefix |
| Registration proof of possession | SDK signProofOfPossession | Pure ML-DSA-87 | Deterministic (library default, no opts passed) | Empty bytes | SDK `dist/index.js:21942,21967–21977`; exact domain below |

Hybrid native transactions, proof of possession and QoreSeal recipient cards retain their deterministic library defaults. M12 explicitly selects FIPS 204's default hedged mode for signatures the application directly controls; it does not patch dependency internals or alter native transaction, registration or recipient-card protocols. Deterministic and hedged FIPS 204 signatures both verify through the existing verifier.

Registration makes a proof-of-possession signature: SDK `dist/index.js:21942,21967–21977`, called by `apps/web/src/onboarding.ts:83` and `packages/chain/src/pqcKey.ts:19`. It signs UTF-8 `qorechain-pqc-pop-v1|chainId|algorithmId|account|lowercasePublicKeyHex` with pure ML-DSA-87, deterministic signing and empty FIPS context. The generic `mldsa` used here aliases `mldsa87` (`@qorechain/pqc/src/index.js:110`); it shares the final-standard implementation and defaults below.

All listed paths use the final FIPS 204 API, not draft Dilithium 3.1: pqc `src/index.js:3–12,59–64` imports noble's `ml_dsa87` and invokes its pure `.sign`; noble `ml-dsa.js:650–659` calls `getMessage`, while its separate prehash API is at `:668–692`. Noble `utils.js:410–415` prepends the pure-mode byte 0 and context length; the default context is empty. pqc passes `extraEntropy: false` by default, selecting deterministic signing; `hedged: true` selects fresh signing randomness. SDK `pqcSign(secretKey, message, opts)` forwards the options directly to `mldsa87.sign`, so M12 uses that supported SDK option. No digest, key, record format, FIPS context or verification rule changes. Existing cached close signatures remain usable during a resumed operation. The SDK still names its algorithm-1 wire enum `AlgorithmDilithium5` (`dist/index.js:22124`); the actual signer resolves to the final-format `mldsa87` implementation above. That legacy enum name does not select draft Dilithium. This is source verification of implementation selection, not independent FIPS validation or certification.

ML-KEM-1024 uses final FIPS 203, not draft Kyber: QoreSeal `dist/chunk-BDY7SXJP.js:193–209` imports `ml_kem1024` and calls encapsulate; noble 0.7.1 `ml-kem.js:309–409` implements the FIPS 203 API and input/modulus checks. pqc `src/index.js:3–12,22–26` declares the final standard and 1568-byte public key/ciphertext. Underlying implementation is noble 0.7.1 for both algorithms. Its introductory documentation still links an `/ipd` URL; the inspected API and final-format context handling, rather than that URL, identify the implementation. Chain-node implementation version and signing randomness of third-party wallets are **not determined** by these client dependencies.

## Domain separation and hybrid authorization

QoreChain pqcVerify at **0x0A01** accepts the pure ML-DSA-87 message with **empty context**. The live accepted/flipped-signature probe is [S16](../evidence/m3-precompiles.json); source/documentation basis is [the precompile knowledge record](../briefing/knowledge/qorechain-evm-pqc.md). Books instead puts domain separation into its message. It verifies the 32 bytes of:

```solidity
keccak256(abi.encodePacked(
    "quaestor:close", block.chainid, address(this),
    book, period, entryCount, lastEntrySha3, closeSha3
))
```

Packed types, in order: string (14 UTF-8 bytes), uint256 (32), address (20), bytes32 (32), bytes32 (32), uint64 (8), bytes32 (32), bytes32 (32). Diana chain ID is 9800; the contract address is Books v2, not the legacy deployment. [Books.sol](../contracts/src/Books.sol) checks the owner's registered algorithm-1, 2592-byte ML-DSA-87 public key and possession proof at **0x0A02**, then verifies the close at **0x0A01**. Invalid or missing precompiles fail closed.

Native hybrid transactions require **both ML-DSA and the classical signature to verify**. The SDK attaches the ML-DSA signature over the extension-free transaction body and auth info, then signs the final SignDoc containing that extension with secp256k1 (`dist/index.js:22121–22147`). This is the native protocol authorization requirement, distinct from EVM signing and from the Books close. The implementation of the remote node's verifier was not audited here. SDK v2 domain is `qorechain-pqc-hybrid-v2`, followed by be64(chain-ID byte length), chain ID, be32(body length), extension-free body, be32(auth-info length), auth info. The SDK still supports v1 without that domain; our browser native client resolves and journals the network-selected version rather than assuming it (`apps/web/src/nativeClient.ts:66–73`). The ML-DSA FIPS context remains empty in either serialization.

## Measured gas and limits

[Receipt reread](../evidence/m11-pq-gas.json): successful Books v2 close `0xcbc5dc60c0c858acde34d541e3d9f91d6388ddb8ae5df9cbef0673166d6391bd`, block 10494795, **259,404 total gas**, **4,868 calldata bytes**. The ML-DSA-87 signature occupies **4,627 bytes** (4,640 ABI-padded); selector, fixed arguments and dynamic length occupy another 228 bytes. The pqcVerify cost **was not isolated**. This is whole-transaction receipt gas, not a portable cryptographic benchmark; no Ethereum comparison was measured.

The pool's **Groth16/BN254 proofs are classical and not post-quantum**. The EVM **secp256k1** key and **X25519** component inside QoreSeal hybrid encryption are also classical. Hybrid envelopes retain ML-KEM-1024 alongside X25519; none of these settings makes EVM consensus, the pool proof system, endpoint security or metadata privacy post-quantum.

## M12 compatibility and acceptance evidence

`pnpm evidence --m12-close` generates [hedged close evidence](../evidence/m12-hedged-close.json): two different signatures over the identical close digest and key, both accepted locally and by a pinned Diana pqcVerify call, a flipped-signature refusal, a deterministic signature accepted at that same block, and a pinned Books close simulation followed by a real close receipt on a fresh empty demo book. Existing M4 signed ciphertext entries/grants and the actual old deterministic close are reverified; the old close signature is also reproduced byte-for-byte with deterministic signing. The receipt is transaction `0xbeae88393b9484f8b1bf7006d46b2a0bb913d648b0e1bf4707a63b7374893247`, block 10750096, 259188 whole-transaction gas; the precompile and Books simulation are pinned to 10750089. This is contract signature acceptance, not a new holdings-coverage demonstration.

[Unfiltered browser checks](../evidence/m12-axe.json) also open the pre-M12 Northwind judge book: five entries remain MATCHED, two periods remain HOLDINGS_COVER_BOOKS and the ungranted period remains refused. The Forge regression replays the public live fixture with the exact precompile boundary mocked; real cryptographic verification is supplied separately by the local ML-DSA checks, pinned live calls and actual Diana receipt. Neither contract source nor deployed bytecode changes.
