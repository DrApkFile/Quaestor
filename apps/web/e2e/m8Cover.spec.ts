import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
test('A05 cover is 1600 by 900, below 5 MB and uses only local original artwork', async ({ page }) => {
  const font = readFileSync('public/fonts/InterTight.ttf').toString('base64');
  const html = readFileSync('../../docs/design/cover.html', 'utf8').replace(
    'FONT_DATA',
    `data:font/ttf;base64,${font}`,
  );
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.setContent(html);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page.getByRole('heading')).toHaveText('Quaestor.');
  expect(requests.filter((value) => !value.startsWith('data:'))).toEqual([]);
  const path = 'public/cover.png';
  await page.screenshot({ path });
  const size = statSync(path).size;
  expect(size).toBeLessThan(5 * 1024 * 1024);
  const header = readFileSync(path);
  expect(header.readUInt32BE(16)).toBe(1600);
  expect(header.readUInt32BE(20)).toBe(900);
  writeFileSync(
    '../../evidence/m8-cover.json',
    JSON.stringify(
      {
        command: 'pnpm evidence --m8-cover',
        status: 'PASSED',
        path: 'apps/web/public/cover.png',
        width: 1600,
        height: 900,
        bytes: size,
        source: 'docs/design/cover.html',
        externalRequests: 0,
      },
      null,
      2,
    ) + '\n',
  );
});
