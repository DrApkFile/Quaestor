import { readFileSync, writeFileSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mergeImageReports } from './m9-image-reports.js';
import { z } from 'zod';
import { deriveUnifiedAccount } from '@qorechain/sdk';
import { accountSealKeys } from '../packages/chain/src/tickets/sealKeys.js';
import { hashBytes } from '../packages/core/src/codec.js';
import { decryptVault } from '../apps/web/src/vault.js';
import { imageScanSecrets } from './m8Secrets.js';
const root = new URL('../', import.meta.url),
  directory = new URL('.accounts/m10-browser/', root);
if (process.argv.includes('--merge-completed')) {
  await import('./m10-merge-scan.js');
  process.exit(0);
}
await imageScanSecrets();
const secrets = new Set(
  z
    .array(z.string())
    .parse(JSON.parse(readFileSync(new URL('.accounts/m7b-browser/scan-secrets.json', root), 'utf8')) as unknown),
);
const collect = (value: unknown, name = '') => {
  if (
    typeof value === 'string' &&
    /^(mnemonic|privateKey|secretKey|secret|key|epochKey|password)$/.test(name) &&
    value.length > 20
  )
    secrets.add(value);
  if (Array.isArray(value)) for (const item of value as unknown[]) collect(item);
  else if (typeof value === 'object' && value !== null)
    for (const [key, item] of Object.entries(value)) collect(item, key);
};
for (const [sessionPath, backupPath] of [
  [new URL('signup-session.json', directory), new URL('signup-backup.json', directory)],
  [new URL('.accounts/m9-browser/signup-session.json', root), new URL('readback-backup.json', directory)],
] as const) {
  if (!existsSync(sessionPath) || !existsSync(backupPath)) continue;
  const session = z
    .object({ password: z.string() })
    .strict()
    .parse(JSON.parse(readFileSync(sessionPath, 'utf8')) as unknown);
  const payload = await decryptVault(JSON.parse(readFileSync(backupPath, 'utf8')) as unknown, session.password);
  const account = await deriveUnifiedAccount(payload.mnemonic, 0),
    keys = accountSealKeys(account);
  collect(session);
  collect(payload);
  collect(account);
  for (const bytes of [account.pqc.secretKey, keys.seed, keys.mlkemSecretKey, keys.x25519SecretKey]) {
    secrets.add(Buffer.from(bytes).toString('hex'));
    secrets.add(Buffer.from(bytes).toString('base64'));
    secrets.add(JSON.stringify(Array.from(bytes)));
    secrets.add(JSON.stringify(bytes));
  }
  const material = Buffer.concat([Buffer.from('quaestor:private-store:v1'), account.pqc.secretKey]);
  const key = await crypto.subtle.importKey(
    'raw',
    Uint8Array.from(Buffer.from(hashBytes(material).slice(2), 'hex')),
    'AES-GCM',
    false,
    ['decrypt'],
  );
  for (const record of payload.journal?.records ?? []) {
    const envelope = z.object({ nonce: z.string(), ciphertext: z.string() }).safeParse(record.value);
    if (!envelope.success) continue;
    const bytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: Buffer.from(envelope.data.nonce, 'base64'), additionalData: Buffer.from(record.key) },
      key,
      Buffer.from(envelope.data.ciphertext, 'base64'),
    );
    collect(JSON.parse(Buffer.from(bytes).toString('utf8')) as unknown);
  }
}
for (const value of [...secrets]) {
  secrets.add(Buffer.from(value).toString('hex'));
  secrets.add(Buffer.from(value).toString('base64'));
  if (/^0x[\da-f]{64}$/i.test(value)) {
    secrets.add(value.slice(2));
    secrets.add(BigInt(value).toString());
    secrets.add(Buffer.from(value.slice(2), 'hex').toString('base64'));
  }
}
writeFileSync(new URL('scan-secrets.json', directory), JSON.stringify([...secrets]), { mode: 0o600 });
const target = new URL('evidence/m10-image-secret-scan.json', root);
if (existsSync(target))
  copyFileSync(target, new URL(`evidence/m10-image-secret-scan-attempt-${String(Date.now())}.json`, root));
const results = await Promise.allSettled(
  [0, 1].map(
    (part) =>
      new Promise<void>((resolve, reject) => {
        const child = spawn(
          new URL('.accounts/m8-ocr/bin/python', root).pathname,
          [new URL('m8-image-scan.py', import.meta.url).pathname],
          {
            cwd: root,
            env: { ...process.env, QUAESTOR_IMAGE_RUN: 'm10', QUAESTOR_IMAGE_PART: String(part) },
            stdio: 'inherit',
          },
        );
        child.on('error', () => {
          reject(new Error('IMAGE_SCAN_PROCESS_FAILED'));
        });
        child.on('exit', (code) => {
          if (code === 0) resolve();
          else reject(new Error('IMAGE_SCAN_FAILED'));
        });
      }),
  ),
);
if (results.some((result) => result.status === 'rejected')) {
  writeFileSync(
    target,
    JSON.stringify(
      { command: 'pnpm evidence --m10-secret-scan', status: 'FAILED', reason: 'IMAGE_SCAN_FAILED' },
      null,
      2,
    ) + '\n',
  );
  process.exitCode = 1;
} else {
  const reports: unknown[] = [0, 1].map(
    (part) =>
      JSON.parse(
        readFileSync(new URL(`evidence/m10-image-secret-scan-part${String(part)}.json`, root), 'utf8'),
      ) as unknown,
  );
  const expected = readdirSync(new URL('evidence/m10-screens/', root))
    .filter((name) => name.endsWith('.png'))
    .map((name) => ({
      file: `evidence/m10-screens/${name}`,
      sha256: createHash('sha256')
        .update(readFileSync(new URL(`evidence/m10-screens/${name}`, root)))
        .digest('hex'),
    }));
  const report = { ...mergeImageReports(reports, expected), command: 'pnpm evidence --m10-secret-scan' };
  writeFileSync(target, JSON.stringify(report, null, 2) + '\n');
  console.log(`M10 screenshot scan PASSED: ${String(report.images.length)} images; every current image hash checked.`);
}
