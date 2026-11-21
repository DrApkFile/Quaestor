import { toHex, type Address } from 'viem';
import type { contextsM4 } from './m4State.js';
import type { setupBooksM4 } from './m4BookSetup.js';
type Contexts = Awaited<ReturnType<typeof contextsM4>>;
type Setup = Awaited<ReturnType<typeof setupBooksM4>>;
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { ablationsM4 } from './m4Lab.js';
import { fullRootHistory } from '../src/rootHistory.js';
import { m2Root } from './m2Context.js';
import { nativeRecords } from './m4State.js';
import { writePrivateJson } from '../src/storage.js';
import { assertPublic } from './m2Evidence.js';
import { accountSecrets } from '../src/nativeError.js';
import { sealSecrets } from '../src/tickets/sealKeys.js';
import type { runHonestM4 } from './m4Honest.js';
import type { runAttackM4 } from './m4Attack.js';
export async function finishM4(
  contexts: Contexts,
  setup: Setup,
  contract: Address,
  run: Awaited<ReturnType<typeof runHonestM4>>,
  lab: Awaited<ReturnType<typeof runAttackM4>>,
) {
  const { business } = contexts;
  const { plan, honest, attack } = setup;
  const {
    opening,
    registered,
    anchors,
    closeTx,
    grantTx,
    ownerATx,
    ownerBTx,
    anchorB,
    shield,
    incoming,
    first,
    second,
    later,
    entries,
  } = run;
  const {
    reusedArtifact,
    failed,
    attackRegister,
    attackAnchor0,
    attackAnchor1,
    attackCloseTx,
    attackGrantTx,
    attackSelfTx,
  } = lab;
  console.log('M4: real-proof ablations and fresh auditor');
  const at = await business.reader.getBlockNumber({ cacheTime: 0 });
  const history = await fullRootHistory(business.reader, business.config, business.poolAbi, at);
  const ablations = await ablationsM4(
    business,
    reusedArtifact,
    attack.key,
    incoming.note,
    attack.book,
    plan.a,
    history.roots,
  );
  if (
    ablations.context.without.kind !== 'MATCHED' ||
    ablations.context.with.kind !== 'UNBACKED' ||
    ablations.rootHistory.without.kind !== 'MATCHED' ||
    ablations.rootHistory.with.kind !== 'UNBACKED'
  )
    throw new Error('ABLATION_FAILED');
  const raw: unknown = JSON.parse(
    execFileSync('pnpm', ['-C', 'packages/chain', 'exec', 'tsx', '../../scripts/m4-auditor.ts'], {
      cwd: m2Root,
      encoding: 'utf8',
      maxBuffer: 2_000_000,
    }),
  );
  const audited = z
    .object({
      pid: z.number(),
      loadedAccounts: z.array(z.literal('auditor')).length(1),
      honest: z
        .object({
          entries: z
            .array(z.object({ verdict: z.object({ kind: z.literal('MATCHED') }).passthrough() }).passthrough())
            .length(3),
          period: z.object({ kind: z.literal('HOLDINGS_COVER_BOOKS') }).passthrough(),
          spentAfterClose: z.literal(true),
        })
        .passthrough(),
      attack: z
        .object({
          entries: z.array(z.object({ verdict: z.object({ kind: z.string(), reason: z.string() }) }).passthrough()),
          period: z.object({ kind: z.literal('HOLDINGS_SHORT') }).passthrough(),
          tampered: z.object({ kind: z.literal('TAMPERED') }).passthrough(),
        })
        .passthrough(),
      periodB: z.object({ reason: z.literal('NOT_GRANTED') }).passthrough(),
    })
    .passthrough()
    .parse(raw);
  if (audited.pid === process.pid || audited.attack.entries[1]?.verdict.reason !== 'WRONG_CONTEXT')
    throw new Error('AUDITOR_FAILED');
  const evidence = {
    command: 'pnpm evidence --m4',
    at: new Date().toISOString(),
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: m2Root, encoding: 'utf8' }).trim(),
    status: 'PASSED',
    demo: true,
    label: 'demo-scale periods; counterparties (demo)',
    contract,
    books: { honest: honest.book, attack: attack.book, attackLabel: 'attack lab (demo)' },
    nativeTransactions: nativeRecords(),
    payments: {
      shield: shield.evidence,
      incoming: incoming.evidence,
      supplier1: first.evidence,
      supplier2: second.evidence,
      periodB: later.evidence,
    },
    transactions: {
      registered,
      anchors,
      closeTx,
      grantTx,
      ownerATx,
      ownerBTx,
      anchorB,
      attackRegister,
      attackAnchor0,
      attackAnchor1,
      attackCloseTx,
      attackGrantTx,
      attackSelfTx,
    },
    entries: entries.map((e) => ({ index: e.index, blobSha3: e.blobSha3 })),
    attackProofConstruction: failed,
    auditor: audited,
    doesNotEstablish: [
      'Groth16/BN254 post-quantum soundness',
      'bookkeeping completeness or collusive hidden income',
      'payments from unbooked funds',
      'payer anonymity or metadata privacy',
      'browser behaviour',
    ],
  };
  const secrets = Object.values(contexts)
    .flatMap((c) => [...accountSecrets(c.account), ...sealSecrets(c.sealKeys)])
    .concat([...opening, incoming.note, first.note, second.note, later.note, later.change].map((n) => n.secret));
  secrets.push(toHex(honest.key.key), toHex(honest.keyB.key), toHex(attack.key.key));
  assertPublic(evidence, secrets);
  assertPublic(ablations, secrets);
  writePrivateJson(`${m2Root}/evidence/m4-ablations.json`, ablations);
  writePrivateJson(`${m2Root}/evidence/m4-verdicts.json`, evidence);
  console.log(JSON.stringify(evidence, null, 2));
}
