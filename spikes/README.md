# Spikes

S01 (offline, confirmed 2026-11-20): QoreSeal recipient check from public keys.

    mkdir -p /tmp/qs && cd /tmp/qs && npm init -y && npm i @qorechain/qoreseal@0.1.0
    node spikes/s01-qoreseal-hint-audit.mjs /tmp/qs

S02 (offline, confirmed 2026-11-20): Gloam SDK shield proof for chain 9800.

    mkdir -p /tmp/gs && cd /tmp/gs && npm init -y && npm i @gloamtrade/sdk@0.8.0 snarkjs
    # copy shield.wasm, final/shield_final.zkey, final/shield_vkey.json from gloamtrade/gloam app/public/circuits into /tmp/art
    node spikes/s02-gloam-sdk-chain-9800.mjs /tmp/gs /tmp/art

Expected outputs: s01-output.txt, s02-output.txt. S03–S12: briefing/REALITY_SPIKES.md.
