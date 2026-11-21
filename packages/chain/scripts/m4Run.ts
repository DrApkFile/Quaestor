import { existsSync } from 'node:fs';
import { z } from 'zod';
import { m2Root } from './m2Context.js';
import { contextsM4, onboardM4 } from './m4State.js';
import { setupBooksM4 } from './m4BookSetup.js';
import { runHonestM4 } from './m4Honest.js';
import { runAttackM4 } from './m4Attack.js';
import { finishM4 } from './m4Finish.js';
import { readJson } from './m3Shared.js';
import { addressSchema } from '../src/config.js';
if (existsSync(`${m2Root}/evidence/m4-verdicts.json`)) throw new Error('M4_RUN_ALREADY_EXISTS');
const deployment = z
  .object({ v2: z.object({ address: addressSchema }).passthrough() })
  .passthrough()
  .parse(readJson(`${m2Root}/evidence/m4-books-v2.json`));
const contexts = await contextsM4();
console.log('M4: registry onboarding and new signed opening');
for (const context of Object.values(contexts)) await onboardM4(context);
const setup = await setupBooksM4(contexts.business, contexts.auditor);
const run = await runHonestM4(contexts, setup, deployment.v2.address);
const lab = await runAttackM4(contexts, setup, deployment.v2.address, run);
await finishM4(contexts, setup, deployment.v2.address, run, lab);
