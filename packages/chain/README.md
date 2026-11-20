# @quaestor/chain

Everything that talks to QoreChain testnet: REST and EVM reads pinned to one block height, ML-DSA-87 and ML-KEM-1024 registries, EVM windows, and the pool wrapper over `@gloamtrade/sdk` (always `chainId: 9800` and our `poolAddress`), plus tree sync from the pool's `Insert` logs.
Built in milestone M2.
