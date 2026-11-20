# Milestone M0 runbook — private rail live on QoreChain testnet

Run on your own machine (Node 22, pnpm, Foundry, git). Save each script's output into `spikes/sNN-output.txt` and fill the matching row in `briefing/REALITY_SPIKES.md`. If a step fails, stop and send the output to Claude; don't work around it.

Everything here is **testnet only**. The accounts are throwaway; never send real funds to them.

## 0. Install
```sh
pnpm install
./scripts/vendor-gloam.sh            # Gloam contracts @ d8db1e6 (already vendored) + circuit files into apps/web/public/circuits (~50 MB, not committed)
pnpm -C contracts forge-std          # forge-std into contracts/lib
forge build --root contracts
```

## 1. Accounts and funds
```sh
pnpm -C scripts accounts             # creates .accounts/{deployer,business,client,supplier1,supplier2,auditor}.json (git-ignored)
pnpm -C scripts env                  # writes tools/evm-window/.env and contracts/.env from the deployer account
```
- Fund **only the deployer** from the faucet (dashboard.qorechain.io/faucet; 100 QOR + 1,000 fUSD per claim, one claim per 24 h). The faucet pays fUSD as a **bank coin**; using it as an ERC-20 needs `MsgConvertCoin` (spike S13, milestone M1).
- Register the deployer's ML-DSA-87 key, then send QOR to the other five accounts:
```sh
pnpm -C tools/evm-window window status
pnpm -C tools/evm-window window register
pnpm -C tools/evm-window fund        # 10 QOR to each of the other five (QUAESTOR_FUND_UQOR to change)
```

## 2. S03 — BN254 precompiles answer correctly on Diana
```sh
pnpm -C scripts s03 | tee spikes/s03-output.txt
```
Four vectors (ecAdd, ecMul, two pairings), checked beforehand against a reference EVM. Needs no window (eth_call).

## 3. PoseidonT3
```sh
pnpm -C tools/evm-window window open           # 600 blocks, 16 txs (enough for steps 3 and 4)
pnpm -C scripts poseidon | tee spikes/s04a-poseidon.txt
POSEIDON2=0x... pnpm -C scripts env            # rewrite contracts/.env with the address it printed
```
The script refuses to send without a live window, then checks `poseidon([1,2])` on chain against circomlibjs.

## 4. Pool, verifiers, memo board
```sh
cd contracts
forge script script/DeployQuaestorPool.s.sol:DeployQuaestorPool --rpc-url qorechain_testnet --broadcast --slow | tee ../spikes/s04b-deploy.txt
```
About 14 transactions: 6 verifiers + 1 dual verifier, the pool, limits on, shield verifier, fUSD limit, native QOR limit, end setup, memo board. Forge checks the final ceremony keys locally before broadcasting. Copy the printed addresses into `evidence/m0-deploy.json` with the tx hashes from `contracts/broadcast/`.

## 5. S04 — Diana verifies a real Groth16 proof on chain
```sh
SHIELD_VERIFIER=0x... POOL=0x... FUSD=0x97143B771D34ddb9130b807b135Ae675A5a963CA pnpm -C scripts s04 | tee spikes/s04-output.txt
```
Builds a fresh shield proof with the Gloam SDK for chain 9800, then `eth_call`s the deployed verifier: the real proof must pass, a tampered amount must fail.

## Send back to Claude
`spikes/s03-output.txt`, `spikes/s04*.txt`, `evidence/m0-deploy.json`, and the window status lines. Then Codex starts M1.
