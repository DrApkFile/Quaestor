import { bn254 } from "@noble/curves/bn254";

const word = (n) => n.toString(16).padStart(64, "0");
const g1Bytes = (p) => { const a = p.toAffine(); return word(a.x) + word(a.y); };
const g2Bytes = (q) => { const a = q.toAffine(); return word(a.x.c1) + word(a.x.c0) + word(a.y.c1) + word(a.y.c0); };

export function bn254Vectors() {
  const G1 = bn254.G1.ProjectivePoint.BASE;
  const G2 = bn254.G2.ProjectivePoint.BASE;
  const two = G1.double();
  const seven = G1.multiply(7n);
  return [
    { name: "ecAdd G1+G1", to: "0x0000000000000000000000000000000000000006", data: "0x" + g1Bytes(G1) + g1Bytes(G1), expect: "0x" + g1Bytes(two) },
    { name: "ecMul G1*7", to: "0x0000000000000000000000000000000000000007", data: "0x" + g1Bytes(G1) + word(7n), expect: "0x" + g1Bytes(seven) },
    { name: "ecPairing e(G1,G2)*e(-G1,G2) = 1", to: "0x0000000000000000000000000000000000000008", data: "0x" + g1Bytes(G1) + g2Bytes(G2) + g1Bytes(G1.negate()) + g2Bytes(G2), expect: "0x" + word(1n) },
    { name: "ecPairing e(G1,G2)*e(G1,G2) = 0", to: "0x0000000000000000000000000000000000000008", data: "0x" + g1Bytes(G1) + g2Bytes(G2) + g1Bytes(G1) + g2Bytes(G2), expect: "0x" + word(0n) },
  ];
}
