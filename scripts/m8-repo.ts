import { writeFileSync } from 'node:fs';
import { z } from 'zod';
const response = await fetch('https://api.github.com/repos/DrApkFile/Quaestor', {
  headers: { Accept: 'application/vnd.github+json' },
});
if (!response.ok) throw new Error('REPOSITORY_CHECK_FAILED');
const repository = z
  .object({
    full_name: z.literal('DrApkFile/Quaestor'),
    private: z.literal(false),
    html_url: z.string().url(),
    license: z.object({ spdx_id: z.literal('MIT') }).passthrough(),
  })
  .passthrough()
  .parse(await response.json());
const evidence = {
  command: 'pnpm evidence --m8-repo',
  at: new Date().toISOString(),
  status: 'PASSED',
  repository: repository.html_url,
  public: !repository.private,
  license: repository.license.spdx_id,
  scope: 'Public GitHub metadata only; not event registration, hosting or project-page verification.',
};
writeFileSync(new URL('../evidence/m8-repo.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
