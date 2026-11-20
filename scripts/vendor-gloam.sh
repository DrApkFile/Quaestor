#!/usr/bin/env bash
set -euo pipefail
GLOAM_COMMIT=d8db1e6c805c5887678fa2c6c82ea617efe1659c
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
git clone --quiet https://github.com/gloamtrade/gloam.git "$WORK/gloam"
git -C "$WORK/gloam" checkout --quiet "$GLOAM_COMMIT"
G="$WORK/gloam"
V="$ROOT/contracts/vendor/gloam"
rm -rf "$V" && mkdir -p "$V/src/interfaces" "$V/src/lib" "$V/src/verifiers/final" "$V/script"
cp "$G/LICENSE" "$V/LICENSE"
cp "$G/contracts/src/ShieldPoolCore.sol" "$G/contracts/src/ShieldPoolPayments.sol" "$G/contracts/src/GloamPayMemo.sol" "$V/src/"
cp "$G"/contracts/src/interfaces/*.sol "$V/src/interfaces/"
cp "$G"/contracts/src/lib/*.sol "$V/src/lib/"
cp "$G/contracts/src/verifiers/DualProofVerifier.sol" "$V/src/verifiers/"
cp "$G"/contracts/src/verifiers/final/*.sol "$V/src/verifiers/final/"
cp "$G/contracts/script/KeyCheckProofs.sol" "$V/script/"
echo "$GLOAM_COMMIT" > "$V/COMMIT"
C="$ROOT/apps/web/public/circuits"
mkdir -p "$C"
for n in shield transfer unshield receipt payroll_total funds; do
  cp "$G/app/public/circuits/$n.wasm" "$C/"
  cp "$G/app/public/circuits/final/${n}_final.zkey" "$G/app/public/circuits/final/${n}_vkey.json" "$C/"
done
( cd "$V" && find . -type f -name '*.sol' | sort | xargs sha256sum ) > "$V/SHA256SUMS"
echo "vendored gloam@$GLOAM_COMMIT into contracts/vendor/gloam and circuits into apps/web/public/circuits"
