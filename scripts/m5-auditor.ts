import { auditM5 } from '../packages/chain/scripts/m5Audit.js';
try {
  process.stdout.write(`${JSON.stringify(await auditM5())}\n`, () => process.exit(0));
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : 'AUDIT_FAILED'}\n`, () => process.exit(1));
}
