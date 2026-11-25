import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
export interface M10Screen {
  view: string;
  width: number;
  fits: boolean;
  javascript: { name: string; bytes: number }[];
  violations: { id: string; impact: string; targets: string[] }[];
}
export async function m10Screens(
  page: Page,
  phase: string,
  view: string,
  run: 'm10' | 'm10b' = 'm10',
): Promise<M10Screen[]> {
  const screens = [];
  mkdirSync(`../../evidence/${run}-screens`, { recursive: true });
  mkdirSync(`../../.accounts/${run}-browser`, { recursive: true, mode: 0o700 });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const text = await page.evaluate(() =>
      [
        document.body.innerText,
        ...Array.from(document.querySelectorAll('input:not([type=password]), textarea')).map((element) =>
          element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.value : '',
        ),
      ].join('\n'),
    );
    expect(await page.evaluate((input) => window.quaestorPrivateCheck?.(input) ?? false, text)).toBe(false);
    writeFileSync(`../../.accounts/${run}-browser/${phase}-${view}-${String(width)}-visible.txt`, text, {
      mode: 0o600,
    });
    await page.screenshot({
      path: `../../evidence/${run}-screens/${phase}-${view}-${String(width)}.png`,
      fullPage: true,
    });
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const javascript = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .filter((entry) => /\.js(?:$|\?)/.test(entry.name))
        .map((entry) => ({
          name: new URL(entry.name).pathname,
          bytes: (entry as PerformanceResourceTiming).encodedBodySize,
        })),
    );
    screens.push({
      view,
      width,
      fits,
      javascript,
      violations: audit.violations.map(({ id, impact, nodes }) => ({
        id,
        impact: impact ?? 'unknown',
        targets: nodes.flatMap((node) =>
          node.target.map((target) => (typeof target === 'string' ? target : JSON.stringify(target))),
        ),
      })),
    });
  }
  return screens;
}
