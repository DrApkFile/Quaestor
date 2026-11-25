import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const run = (args: string[]) => {
  const result = spawnSync('forge', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stdout + result.stderr);
  return result.stdout;
};
const compile = (name: string, source: string) => {
  const temp = mkdtempSync(join(tmpdir(), 'quaestor-m11-'));
  mkdirSync(join(temp, 'src'));
  writeFileSync(join(temp, 'src', `${name}.sol`), source);
  const args = [
    'build',
    '--root',
    temp,
    '--use',
    '0.8.24',
    '--evm-version',
    'shanghai',
    '--optimize',
    '--optimizer-runs',
    '200',
    '--no-metadata',
  ];
  const output = run(args);
  const artifact = z
    .object({ deployedBytecode: z.object({ object: z.string() }) })
    .parse(JSON.parse(readFileSync(join(temp, 'out', `${name}.sol`, `${name}.json`), 'utf8')) as unknown);
  return { runtime: artifact.deployedBytecode.object.toLowerCase(), command: `forge ${args.join(' ')}`, output };
};
const rpc = async (method: string, params: unknown[]) => {
  const response = await fetch('https://evm-testnet.qore.host', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(30000),
  });
  const body = z.object({ result: z.string() }).parse((await response.json()) as unknown);
  return body.result;
};
const check = process.argv.includes('--check');
const old = check
  ? z
      .object({
        chainId: z.literal('0x2648'),
        block: z.string(),
        results: z.array(
          z.object({
            name: z.string(),
            address: z.string(),
            deployedCode: z.string(),
            runtimeSha256: z.string(),
            stage1Sha256: z.string(),
            stage2Sha256: z.string(),
          }),
        ),
      })
      .parse(JSON.parse(read('evidence/m11-bytecode-equivalence.json')) as unknown)
  : null;
const chainId = old?.chainId ?? (await rpc('eth_chainId', []));
if (chainId !== '0x2648') throw new Error('DIANA_REQUIRED');
const block = old?.block ?? (await rpc('eth_blockNumber', []));
const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
const results = [];
for (const [name, address] of [
  ['Books', '0x9775c1d0dc814e41fb1b38d26fa17f60d24faf64'],
  ['BlobBoard', '0xe79e5a3108d8e856aa7ac770c97ac7af308c1d67'],
] as const) {
  const stage1 = read(`docs/audit/${name}.flat.sol`);
  const current = read(`contracts/src/${name}.sol`);
  const file = `docs/audit/${name}.stage2.flat.sol`;
  if (!check) {
    const header = `// Source git commit: ${commit}\n// Diana (qorechain-diana, EVM 9800): ${address}\n// File SHA-256 (this field normalized to 64 zeros): ${'0'.repeat(64)}\n// Logic identical to deployed bytecode; see evidence/m11-bytecode-equivalence.json\n`;
    const normalized = header + current;
    writeFileSync(new URL(file, root), normalized.replace('0'.repeat(64), sha(normalized)));
  }
  const stage2 = read(file);
  const headerHash = stage2.match(/normalized to 64 zeros\): ([a-f0-9]{64})/)?.[1];
  if (!headerHash || sha(stage2.replace(headerHash, '0'.repeat(64))) !== headerHash)
    throw new Error('HEADER_HASH_MISMATCH');
  const first = compile(name, stage1),
    second = compile(name, stage2),
    source = compile(name, current);
  const stored = old?.results.find((result) => result.name === name);
  if (check && !stored) throw new Error('EVIDENCE_MISSING');
  const deployedCode = stored?.deployedCode ?? (await rpc('eth_getCode', [address, block])).toLowerCase();
  const metadataBytes = Number.parseInt(deployedCode.slice(-4), 16) + 2;
  if (!Number.isFinite(metadataBytes) || metadataBytes < 3 || metadataBytes * 2 >= deployedCode.length - 2)
    throw new Error('INVALID_CBOR_LENGTH');
  const deployedRuntime = deployedCode.slice(0, -metadataBytes * 2);
  if (
    first.runtime !== second.runtime ||
    second.runtime !== source.runtime ||
    source.runtime + 'fe' !== deployedRuntime
  )
    throw new Error(`${name}: BYTECODE_DIVERGED`);
  const runtimeSha256 = sha(source.runtime);
  if (
    stored &&
    (stored.address !== address ||
      stored.runtimeSha256 !== runtimeSha256 ||
      stored.stage1Sha256 !== sha(stage1) ||
      stored.stage2Sha256 !== sha(stage2))
  )
    throw new Error('EVIDENCE_DRIFT');
  results.push({
    name,
    address,
    stage1Sha256: sha(stage1),
    stage2Sha256: sha(stage2),
    runtimeSha256,
    runtimeBytes: (source.runtime.length - 2) / 2,
    deployedCode,
    metadataBytes,
    metadataSeparator: 'fe (Solidity INVALID, omitted by --no-metadata)',
    equal: true,
    compiles: [first, second, source].map(({ command, output }) => ({ command, output, exit: 0 })),
  });
  console.log(`T-M11 ${name}: stage1 = stage2 = source = deployed runtime (CBOR removed)`);
}
if (!check)
  writeFileSync(
    new URL('evidence/m11-bytecode-equivalence.json', root),
    JSON.stringify(
      {
        command: 'pnpm evidence --m11-bytecode',
        at: new Date().toISOString(),
        commit,
        chainId,
        block,
        results,
        gate: 'Offline recompile against retained pinned eth_getCode; regenerate via evidence for fresh chain reads.',
      },
      null,
      2,
    ) + '\n',
  );
