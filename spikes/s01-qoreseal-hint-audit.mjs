import { createRequire } from "node:module";
const req = createRequire(process.argv[2] + "/");
const qs = await import(req.resolve("@qorechain/qoreseal"));
const { EpochKeyManager, generateSealKeys, recipientOf, parseEnvelope, recipientHint, openEpochKey, toHex } = qs;

const chainId = "qorechain-diana", purpose = "quaestor:spike";
const keys = { ada: generateSealKeys(), bayo: generateSealKeys(), chi: generateSealKeys(), dee: generateSealKeys() };
const pub = (id) => keys[id].mlkemPublicKey;

function auditExactSet(envelope, expectedIds) {
  const env = parseEnvelope(envelope);
  const hints = new Set(env.entries.map((e) => toHex(e.hint)));
  const missing = expectedIds.filter((id) => !hints.has(toHex(recipientHint(env.salt, pub(id)))));
  return { entries: env.entries.length, anonymous: env.anonymous, missing, exact: !env.anonymous && missing.length === 0 && env.entries.length === expectedIds.length };
}
function tryOpen(envelope, id) {
  try { const k = openEpochKey({ chainId, purpose, envelope, keys: keys[id] }); return `epoch ${k.epoch}`; }
  catch (e) { return `refused (${e.code ?? e.message})`; }
}

const mgr = new EpochKeyManager({ chainId, purpose, members: { ada: recipientOf(keys.ada), bayo: recipientOf(keys.bayo), chi: recipientOf(keys.chi) } });
const e1 = mgr.distribution();
console.log("epoch", mgr.epoch, "size", e1.length, "audit vs {ada,bayo,chi}:", auditExactSet(e1, ["ada","bayo","chi"]));
console.log("audit vs {ada,bayo} (claims chi absent):", auditExactSet(e1, ["ada","bayo"]));
const r = mgr.removeMember("chi");
console.log("after chi lapses -> epoch", r.epoch, "audit vs {ada,bayo}:", auditExactSet(r.envelope, ["ada","bayo"]));
console.log("ada opens:", tryOpen(r.envelope, "ada"), "| chi opens:", tryOpen(r.envelope, "chi"), "| dee (never paid):", tryOpen(r.envelope, "dee"));
console.log("chi still opens old epoch:", tryOpen(e1, "chi"));
