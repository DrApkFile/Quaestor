import { readFileSync } from 'node:fs';
import { z } from 'zod';
export const fixturePath = z.string().min(1).parse(process.env.QUAESTOR_M6_FIXTURES);
export const fixture = z
  .object({
    password: z.string(),
    label: z.string(),
    roles: z.record(z.object({ backup: z.string(), address: z.string() }).strict()),
    canaries: z.array(z.string()).length(4),
  })
  .strict()
  .parse(JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown);
export const folder = fixturePath.slice(0, fixturePath.lastIndexOf('/'));
export function roleFixture(name: string) {
  const value = fixture.roles[name];
  if (!value) throw new Error('ROLE_FIXTURE_REQUIRED');
  return value;
}
