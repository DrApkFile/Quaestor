# QoreChain EVM, PQC precompiles and accounts (what the Books contract and the pool deploy need)

Researched: 2026-11-20
Primary sources: qorechain-core/docs/EVM_PRECOMPILES.md and contracts/interfaces/IQorePQC.sol; qorechain-sdk/docs/docs/guides/evm-differences.md; build.qorechain.io/faq; qorex-integrations/packages/types/src/providers.ts (all cloned/fetched 20 Nov).

## What it actually is
QoreChain is a Cosmos SDK v0.53 chain with EVM, CosmWasm and SVM. Testnet `qorechain-diana`, EVM chain ID 9800. Every EVM transaction needs the sender to have a registered ML-DSA-87 key and an open **EVM authorization window**.

## Core concepts you need before building
- **EVM window:** opened with `MsgOpenEVMWindow`, a native-lane, hybrid-signed (secp256k1 + ML-DSA-87) message. Bounds blocks, number of EVM txs and total spend (value + max fee, in uqor). Opening advances the nonce: **open first, then read the nonce, then sign.** `eth_call`/`eth_estimateGas` need no window. Rotating/re-registering the PQC key closes the window. Read at `/qorechain/pqc/v1/evm_window/{qor1}`. Foundry/Hardhat templates include `pnpm window register|open`. `@qorechain/evm` exports `evmWindowStatus`, `openEvmWindowMessage`, chains `qorechainTestnet` (9800).
- **pqcKeyStatus (0x0A02):** `pqcKeyStatus(address) → (bool registered, uint8 algorithmId, bytes pubkey, bool possessionProven)`. 2,500 gas flat (~7,100 inside a contract). `algorithmId == 1` is ML-DSA-87.
- **Security:** anyone can register someone else's public key for their own account. **Require `possessionProven`** before trusting a key as "this account's".
- **pqcVerify (0x0A01):** `pqcVerify(pubkey 2592 B, sig 4627 B, message) → bool`, never reverts, ~85k gas precompile charge, ~313k per tx mostly calldata. Bind signed messages to chain id + contract + nonce or they replay.
- **No ML-KEM on EVM.** The contract cannot see the KEM registry. KEM checks happen in the door engine and auditor off chain.
- **Inactive precompile:** high-level Solidity call reverts (safe); low-level `staticcall` succeeds with empty data — decode with `abi.decode`, never by hand.
- QoreX provider: EVM (`eth_*`, `personal_sign`), Cosmos, Solana; `signArbitrary` rejects "not yet supported"; no KEM/decrypt method.

## Endpoints and tokens (testnet)
- REST `https://api-testnet.qore.host`, consensus RPC `https://rpc-testnet.qore.host`, EVM RPC `https://evm-testnet.qore.host`, EVM WS `wss://evm-ws-testnet.qore.host` (from `getNetwork("testnet")` in @qorechain/sdk 0.14.0).
- fUSD: 6 decimals, ERC-20 `0x97143B771D34ddb9130b807b135Ae675A5a963CA`; the faucet pays the bank-coin form `erc20:0x9714…`, convert with `MsgConvertCoin` (docs.qorechain.io/dashboard/faucet, 20 Nov).
- `eth_gasPrice` ≈ 112.5 gwei on both networks per the Foundry template README; windows account at the fee cap.
- Window helper: `tools/evm-window` (create-qorechain-dapp@0.14.0 foundry template): `status`, `register`, `open` (QORE_WINDOW_TXS, QORE_WINDOW_BLOCKS), plus our `fund`.

## Status conflict (keep on record)
- EVM_PRECOMPILES.md status note dated **2026-10-25**: no QoreChain precompile active on Diana yet; expected after v3.2.5.
- build.qorechain.io/faq (fetched 20 Nov): PQC precompiles **are active on diana**, not on mainnet.
- Other entrants (Allot) use 0x0A02 on Diana. → Settle with spike S09 (`GET /cosmos/evm/vm/v1/params`, and an `eth_call` to 0x0A02 for a known registered account).

## Minimal working shape
```solidity
interface IQorePQC {
  function pqcKeyStatus(address) external view returns (bool, uint8, bytes memory, bool);
}
IQorePQC constant PQC = IQorePQC(address(0x0A02));
function _requireProvenPqKey(address who) view {
  (bool registered, uint8 algo, , bool proven) = PQC.pqcKeyStatus(who);
  if (!registered) revert NoPqKey(who);
  if (algo != 1) revert NotMlDsa87(who, algo);
  if (!proven) revert PossessionNotProven(who);
}
```

## Known gotchas / traps
- Window spend counts gas cap at the fee cap (docs mention 200 gwei accounted vs ~112.5 paid) — open windows with headroom.
- The same account's native sequence and EVM nonce are one counter.
- Native-lane txs from an account with a PQ key are always hybrid.

## Unverified: confirm with a reality spike
S03 (BN254 precompiles), S04 (deploying the pool under window rules), S06 (Groth16 verify gas vs window limits), S09 (pqc precompiles active).

## Out of scope
Cross-VM bridge, SVM, CosmWasm, AI precompiles.
