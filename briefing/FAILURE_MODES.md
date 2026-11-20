# FAILURE_MODES — Quaestor

## Diana reads (REST, EVM RPC)
| Mode | Guard | Where | Test |
|---|---|---|---|
| Timeout / 5xx | 3 retries with backoff, then `UNKNOWN`; never `MATCHED` | packages/chain/read.ts | T-FAIL-READ |
| Mixed heights in one decision | every read for one verdict pinned to one block | packages/chain/snapshot.ts | T-FAIL-HEIGHT |
| Log range capped | page `eth_getLogs` by range; a gap → `UNKNOWN` | packages/chain/logs.ts | T-FAIL-LOG-GAP |
| Root not in pool history | the pool's `isKnownRoot` only keeps the last 100 roots (IncrementalMerkleTreePoseidon `rootHistorySize = 100`), so audits months later can't rely on it. The verdict engine rebuilds the tree from the pool’s insertion events (Shielded, Transferred) and accepts a receipt's root only if it is a root the tree actually had → else `UNBACKED` | packages/core/verdict.ts | T-VERDICT-UNKNOWN-ROOT, T-VERDICT-OLD-ROOT |

## Diana writes (pool txs, memo posts, Books anchors)
| Mode | Guard | Where | Test |
|---|---|---|---|
| Broadcast timeout → outcome unknown | journal intent before broadcast (IndexedDB); state `OUTCOME_UNKNOWN`; poll by hash; never re-send a spend whose nullifier may be used | apps/web/journal | T-JOURNAL-UNKNOWN |
| Double spend of a note | pool rejects used nullifier; app marks note `SPENT` only after receipt | apps/web/notes | T-NOTES-SPENT-ONLY-ON-RECEIPT |
| Payment landed, memo post failed | ticket kept locally and re-posted; payee can also receive by link; entry stays `PENDING_TICKET` | apps/web/pay | T-PAY-MEMO-RETRY |
| Payment landed, book entry not anchored | entry kept locally as `UNANCHORED`, anchored on next open; reconciliation refuses to close the quarter until all are anchored | apps/web/books | T-BOOKS-CLOSE-REFUSES-UNANCHORED |
| Window closed | read `/evm_window/{addr}` first; `WINDOW_CLOSED` to the UI | packages/chain/window.ts | T-FAIL-WINDOW |
| Anchor replay / out of order | Books contract requires `index == nextIndex[book][quarter]` and `prevHash` match | contracts/Books.sol | T-BOOKS-ORDER |

## Keys and notes in the browser
| Mode | Guard | Test |
|---|---|---|
| Storage cleared → notes and keys lost | mandatory encrypted backup file before first payment; restore flow | T-WEB-BACKUP-REQUIRED |
| Keys derived from a wallet signature | forbidden; seal keys from the in-app account mnemonic only | T-KEYS-NOT-FROM-SIGNATURE |
| P-256 ticket fallback | ticket sealing has no P-256 path in our code; an unregistered payee is refused `NO_KEM_KEY` | T-TICKET-NO-CLASSICAL-FALLBACK |

## Store (ciphertext only)
| Mode | Guard | Test |
|---|---|---|
| Tampered blob | content-addressed by SHA3-256 = on-chain anchor → `TAMPERED` | T-VERDICT-TAMPERED |
| Missing blob | `UNKNOWN(BLOB_UNAVAILABLE)` | T-VERDICT-MISSING-BLOB |
| Plaintext uploaded | store accepts only QoreSeal envelopes / sealed batches / signed records; else 400 | T-NOPLAIN-STORE |

## Secrets
Deployer key only in env for deploy scripts, validated at startup, never logged. Secret scan in the gate. Demo mnemonics are testnet-only, labelled, and never committed.
