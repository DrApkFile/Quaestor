import { z } from 'zod';
import { artifactSchema, grantSchema, sealedRecordSchema, hex32, periodId } from '@quaestor/core';
import { addressSchema } from '../src/config.js';
import { evidenceSchema } from '../src/evidence.js';
const bookSchema = z
  .object({
    book: hex32,
    entries: z.array(artifactSchema),
    grant: grantSchema,
    opening: sealedRecordSchema,
    close: sealedRecordSchema,
    closeTx: evidenceSchema.shape.payments.element,
  })
  .strict();
export const m4ManifestSchema = z
  .object({
    contract: addressSchema,
    pool: addressSchema,
    business: z.string(),
    periodA: periodId,
    periodB: periodId,
    honest: bookSchema.extend({ entryB: artifactSchema, selfB: grantSchema }).strict(),
    attack: bookSchema
      .extend({
        label: z.literal('attack lab (demo)'),
        servedTamper: artifactSchema,
        proofBuild: z.literal('INSUFFICIENT_SELECTED_HOLDINGS'),
      })
      .strict(),
  })
  .strict();
export type M4Manifest = z.infer<typeof m4ManifestSchema>;
