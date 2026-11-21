import { auditM3 } from '../packages/chain/scripts/m3Audit.js';
try {
  console.log(JSON.stringify(await auditM3()));
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : '';
  console.error(JSON.stringify({ errorCode: /^[A-Z_]+$/.test(message) ? message : 'AUDIT_FAILED' }));
  process.exitCode = 1;
}
