import { existsSync } from 'node:fs';
import { z } from 'zod';
import { execFileSync } from 'node:child_process';
import { m2Root } from './m2Context.js';
import { deployBooks } from './m3Deploy.js';
import { readJson } from './m3Shared.js';
import { addressSchema } from '../src/config.js';
import { writePrivateJson } from '../src/storage.js';
const path = `${m2Root}/evidence/m4-books-v2.json`;
if (existsSync(path)) throw new Error('V2_ALREADY_DEPLOYED');
const v1 = z
  .object({ contract: addressSchema })
  .passthrough()
  .parse(readJson(`${m2Root}/evidence/m3-books.json`));
const v2 = await deployBooks('m4');
const evidence = {
  command: 'pnpm evidence --m4-deploy',
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: m2Root, encoding: 'utf8' }).trim(),
  at: new Date().toISOString(),
  v1: { version: 1, address: v1.contract, evidence: 'evidence/m3-books.json' },
  v2: { version: 2, ...v2 },
};
writePrivateJson(path, evidence);
console.log(JSON.stringify(evidence, null, 2));
