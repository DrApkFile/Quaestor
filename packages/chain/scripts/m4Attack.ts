import type { Address } from 'viem';
import type { contextsM4 } from './m4State.js';
import type { setupBooksM4 } from './m4BookSetup.js';
type Contexts = Awaited<ReturnType<typeof contextsM4>>;
type Setup = Awaited<ReturnType<typeof setupBooksM4>>;
import { zeroAddress, type Hex } from 'viem';
import {
  openingSchema,
  closingBalances,
  decryptEntry,
  closeRecord,
  holdingsCloseSchema,
  hashRecord,
  contractPeriod,
  type Entry,
} from '@quaestor/core';
import { entryM4, fundsM4, recordM4, closeM4 } from './m4Records.js';
import { rawLabEntry } from './m4Lab.js';
import { m4ManifestSchema } from './m4Manifest.js';
import { m4Public } from './m4State.js';
import { writePrivateJson } from '../src/storage.js';
import type { runHonestM4 } from './m4Honest.js';
export async function runAttackM4(
  contexts: Contexts,
  setup: Setup,
  contract: Address,
  run: Awaited<ReturnType<typeof runHonestM4>>,
) {
  const { business, supplier1, auditor } = contexts;
  const { plan, honest, attack } = setup;
  const { call, anchor, opening, later, zero, e0, entries, openingCipher, closeCipher, closeTx, entryB } = run;
  console.log('M4: on-chain attack lab');
  const attackOpening = openingSchema.parse({
    v: 1,
    book: attack.book,
    openingBalance: { [zeroAddress]: '100000000000000000000' },
    at: plan.issuedAt,
  });
  const attackOpeningCipher = recordM4(business, attackOpening, attack.key, 'attack-opening', attack.book);
  const attackRegister = await call('m4-attack-register', 'registerBook', [plan.attackSalt, attackOpeningCipher.sha3]);
  const original = await entryM4(
    business,
    later.note,
    attack.book,
    plan.a,
    0,
    zero,
    'OUT',
    supplier1.account.cosmos,
    attack.key,
    'attack',
  );
  const reused: Entry = {
    ...decryptEntry(e0, honest.key),
    book: attack.book,
    index: 1,
    prevEntrySha3: original.blobSha3,
    notes: 'Invented payment by receipt reuse (attack lab demo)',
  };
  const reusedArtifact = rawLabEntry(business, reused, attack.key, 'attack-reuse');
  const attackAnchor0 = await anchor(original, 'm4-attack-a-0');
  const attackAnchor1 = await anchor(reusedArtifact, 'm4-attack-a-1');
  const attackClosing = closingBalances(attackOpening.openingBalance, [decryptEntry(original, attack.key), reused], {});
  const held = [...opening, later.change];
  const failed = await fundsM4(business, held, attackClosing, attack.book, plan.a, 'attack-inflated');
  if (failed.kind !== 'BLOCKED' || failed.code !== 'INSUFFICIENT_SELECTED_HOLDINGS')
    throw new Error('ATTACK_NOT_SHORT');
  const lower = { [zeroAddress]: held.reduce((sum, n) => sum + BigInt(n.amountWei), 0n).toString() };
  const lowerProof = await fundsM4(business, held, lower, attack.book, plan.a, 'attack-lower');
  if (lowerProof.kind !== 'PROVED') throw new Error(lowerProof.code);
  const attackClose = holdingsCloseSchema.parse({
    ...closeRecord(attack.book, plan.a, [original, reusedArtifact], 2),
    priorSha3: attackOpeningCipher.sha3,
    closingBalance: attackClosing,
    cashOutFees: {},
    holdings: { [zeroAddress]: lowerProof.proof },
  });
  const attackCloseCipher = recordM4(business, attackClose, attack.key, 'attack-close', attack.book);
  const attackCloseTx = await closeM4(business, contract, attackClose, 'm4-attack-close');
  const attackGrantTx = await call('m4-attack-grant', 'anchorGrant', [
    attack.book,
    contractPeriod(plan.a),
    auditor.account.evm,
    hashRecord(attack.grant),
  ]);
  const attackSelfTx = await call('m4-attack-self', 'anchorGrant', [
    attack.book,
    contractPeriod(plan.a),
    business.account.evm,
    hashRecord(attack.own),
  ]);
  const servedTamper = {
    ...original,
    blob: `${original.blob.slice(0, -2)}${original.blob.endsWith('00') ? '01' : '00'}` as Hex,
  };
  const manifest = m4ManifestSchema.parse({
    contract,
    pool: business.config.pool,
    business: business.account.cosmos,
    periodA: plan.a,
    periodB: plan.b,
    honest: {
      book: honest.book,
      entries,
      grant: honest.grant,
      opening: openingCipher,
      close: closeCipher,
      closeTx,
      entryB,
      selfB: honest.selfB,
    },
    attack: {
      label: 'attack lab (demo)',
      book: attack.book,
      entries: [original, reusedArtifact],
      grant: attack.grant,
      opening: attackOpeningCipher,
      close: attackCloseCipher,
      closeTx: attackCloseTx,
      servedTamper,
      proofBuild: failed.code,
    },
  });
  writePrivateJson(`${m4Public}/manifest.json`, manifest);

  return {
    reusedArtifact,
    failed,
    attackRegister,
    attackAnchor0,
    attackAnchor1,
    attackCloseTx,
    attackGrantTx,
    attackSelfTx,
  };
}
