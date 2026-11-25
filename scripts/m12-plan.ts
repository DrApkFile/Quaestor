import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { toHex, zeroHash, zeroAddress, type Address } from 'viem';
import { bookId, periodKey, sealRecord, sealedRecordSchema, closeDigestV2 } from '../packages/core/src/index.js';
import { m2Root, type M2Context } from '../packages/chain/scripts/m2Context.js';
import { artifact, signingKeys } from '../packages/chain/scripts/m3Shared.js';
import { addressSchema, hexSchema } from '../packages/chain/src/config.js';
import { signCloseDigest } from '../apps/web/src/business/closeSignature.js';
export function m12Plan(context: M2Context, contract: Address) {
  return artifact(
    `${m2Root}/.accounts/m12/public-plan.json`,
    z
      .object({
        salt: hexSchema,
        book: hexSchema,
        period: z.string(),
        opening: sealedRecordSchema,
        close: sealedRecordSchema,
        signature: hexSchema,
        secondSignature: hexSchema,
      })
      .strict(),
    () => {
      const salt = toHex(randomBytes(32)),
        book = bookId(addressSchema.parse(context.account.evm), salt);
      const period = new Date().toISOString().slice(0, 10),
        key = periodKey(1n, randomBytes(32));
      const keys = signingKeys(context),
        openingBalance = { [zeroAddress]: '0' };
      const opening = sealRecord(
        { v: 1, book, openingBalance, periodLength: 'Daily (demo-scale)', at: new Date().toISOString() },
        key,
        keys,
        `quaestor:${book}:opening`,
      );
      const close = sealRecord(
        {
          v: 1,
          book,
          period,
          entryCount: 0,
          lastEntrySha3: zeroHash,
          priorSha3: opening.sha3,
          openingBalance,
          periodLength: 'Daily (demo-scale)',
          closingBalance: openingBalance,
          cashOutFees: {},
          holdings: {},
        },
        key,
        keys,
        `quaestor:${book}:close`,
      );
      const digest = closeDigestV2(book, period, 0, zeroHash, close.sha3, 9800n, contract);
      return {
        salt,
        book,
        period,
        opening,
        close,
        signature: signCloseDigest(context.account.pqc.secretKey, digest),
        secondSignature: signCloseDigest(context.account.pqc.secretKey, digest),
      };
    },
  );
}
