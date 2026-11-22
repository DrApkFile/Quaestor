import { expect, type Page } from '@playwright/test';
import { fixture } from './m6Fixtures.js';
import { navigate } from './m6Driver.js';
import { shots } from './m7Tools.js';
export async function captureDemoScreens(b: Page, id: string, openOther: () => Promise<Page>) {
  for (const name of ['Wallet', 'Pay', 'Receive', 'Books', 'Grants']) {
    await navigate(b, name);
    if (name === 'Books' && fixture.publicDemo) {
      await expect(b.getByText('December planning deposit', { exact: true })).toBeVisible();
    }
    await shots(b, name.toLowerCase());
  }
  await navigate(b, 'Public check');
  await b.getByLabel('Book ID (demo)', { exact: true }).fill(id);
  await b.getByRole('button', { name: 'Check chain', exact: true }).click();
  await expect(b.getByText('anchored entries', { exact: true })).toBeVisible({ timeout: 300000 });
  await shots(b, 'public');
  await b.getByRole('button', { name: 'Account', exact: true }).click();
  await shots(b, 'account');
  const o = await openOther();
  await o.goto('/');
  await shots(o, 'landing');
}
