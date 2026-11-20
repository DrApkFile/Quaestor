import { runM2Worker } from '../packages/chain/scripts/m2Worker.js';
try {
  const result = await runM2Worker(process.argv[2], process.argv[3], process.argv[4], process.argv[5]);
  console.log(JSON.stringify(result));
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : '';
  console.error(JSON.stringify({ errorCode: /^[A-Z_]+$/.test(message) ? message : 'WORKER_FAILED' }));
  process.exitCode = 1;
}
