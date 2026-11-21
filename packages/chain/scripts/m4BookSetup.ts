import { randomBytes } from 'node:crypto';
import { toHex, type Hex } from 'viem';
import { z } from 'zod';
import { bookId, periodKey, grantSchema, grantPeriod, openGrant } from '@quaestor/core';
import { artifact, signingKeys } from './m3Shared.js';
import { m4Dir, m4Public } from './m4State.js';
import { m2Root, type M2Context } from './m2Context.js';
import { resolveCard } from '../src/tickets/card.js';
import { readRegistry } from '../src/tickets/kemRegistry.js';
import { addressSchema, hexSchema } from '../src/config.js';
export async function setupBooksM4(business: M2Context, auditor: M2Context) {
  const plan = artifact(
    `${m4Dir}/plan.json`,
    z.object({ salt: hexSchema, attackSalt: hexSchema, a: z.string(), b: z.string(), issuedAt: z.string() }).strict(),
    () => {
      const now = new Date();
      return {
        salt: toHex(randomBytes(32)),
        attackSalt: toHex(randomBytes(32)),
        a: now.toISOString().slice(0, 10),
        b: new Date(now.getTime() + 86400000).toISOString().slice(0, 10),
        issuedAt: now.toISOString(),
      };
    },
  );
  const block = await business.reader.getBlockNumber({ cacheTime: 0 });
  const registry = await readRegistry(business.config, business.account.cosmos, block);
  const [self, payee] = await Promise.all(
    [business, auditor].map((context) =>
      resolveCard(business.config, `${m2Root}/cards/${context.account.cosmos}.json`, context.account.cosmos, block),
    ),
  );
  if (!self || !payee || self.kind !== 'VERIFIED' || payee.kind !== 'VERIFIED') throw new Error('CARD_INVALID');
  const signer = signingKeys(business);
  const make = (salt: Hex, label: string) => {
    const book = bookId(addressSchema.parse(business.account.evm), salt);
    const own = artifact(`${m4Public}/${label}-self-a.json`, grantSchema, () =>
      grantPeriod(
        book,
        plan.a,
        business.account.cosmos,
        periodKey(1n, randomBytes(32)),
        self.recipient,
        plan.issuedAt,
        signer,
      ),
    );
    const key = openGrant(
      own,
      book,
      plan.a,
      business.account.cosmos,
      business.sealKeys,
      business.account.cosmos,
      registry.pqPublicKey,
    );
    const grant = artifact(`${m4Public}/${label}-auditor-a.json`, grantSchema, () =>
      grantPeriod(book, plan.a, auditor.account.cosmos, key, payee.recipient, plan.issuedAt, signer),
    );
    return { book, own, key, grant };
  };
  const honest = make(plan.salt, 'honest');
  const attack = make(plan.attackSalt, 'attack');
  const selfB = artifact(`${m4Public}/honest-self-b.json`, grantSchema, () =>
    grantPeriod(
      honest.book,
      plan.b,
      business.account.cosmos,
      periodKey(2n, randomBytes(32)),
      self.recipient,
      plan.issuedAt,
      signer,
    ),
  );
  const keyB = openGrant(
    selfB,
    honest.book,
    plan.b,
    business.account.cosmos,
    business.sealKeys,
    business.account.cosmos,
    registry.pqPublicKey,
  );
  return { plan, honest: { ...honest, selfB, keyB }, attack };
}
