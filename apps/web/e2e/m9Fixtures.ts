import { readFileSync } from 'node:fs';
import { z } from 'zod';
export function m9Fixtures() {
  const fixture = z
    .object({ password: z.string(), roles: z.record(z.object({ backup: z.string(), address: z.string() }).strict()) })
    .passthrough()
    .parse(JSON.parse(readFileSync('../../.accounts/m7b-browser/fixtures.json', 'utf8')) as unknown);
  const business = fixture.roles.business;
  if (business) business.backup = '../../.accounts/m7b-browser/business-complete.json';
  return fixture;
}
