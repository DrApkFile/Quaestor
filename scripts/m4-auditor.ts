import { auditM4 } from '../packages/chain/scripts/m4Audit.js';
try {
  process.stdout.write(`${JSON.stringify(await auditM4())}\n`, () => process.exit(0));
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : 'AUDIT_FAILED'}\n`, () => process.exit(1));
}
