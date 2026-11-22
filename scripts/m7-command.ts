import { spawnSync } from 'node:child_process';
import { openSync, closeSync, readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
export function m7Command(name: string, args: string[], fixture: string, secrets: readonly string[]) {
  const log = new URL(`.accounts/m7-browser/${name}-${String(Date.now())}.log`, root);
  const fd = openSync(log, 'w', 0o600);
  const result = spawnSync('pnpm', args, {
    cwd: root,
    env: { ...process.env, QUAESTOR_M6_FIXTURES: fixture, TMPDIR: new URL('.accounts/m7-browser/tmp/', root).pathname },
    stdio: ['ignore', fd, fd],
  });
  closeSync(fd);
  let output = readFileSync(log, 'utf8');
  for (const secret of secrets) output = output.split(secret).join('[PRIVATE]');
  console.log(
    output
      .split('\n')
      .filter((line) => !/^M6 (request|response|continued|stalled)/.test(line))
      .join('\n'),
  );
  return result.status ?? 1;
}
