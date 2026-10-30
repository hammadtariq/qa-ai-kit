import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Accessibility smoke check with axe (https://github.com/dequelabs/axe-core): fails only on serious and critical
 * issues (WCAG 2.1 A and AA rules); minor and moderate ones are listed in an "a11y" annotation, and the full
 * axe result is attached to the report. One test per page of a key journey, tagged @a11y, in <testDir>/a11y/:
 *
 *   test('checkout page', { tag: '@a11y' }, async ({ page }) => {
 *     await page.goto('/checkout');
 *     await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
 *     await expectAccessible(page);
 *   });
 *
 * `exclude` skips parts of the page the team doesn't own (a third-party chat widget); `disable` turns off rules
 * by id, each with a reason in a comment where it's called.
 */
export async function expectAccessible(page: Page, options: { include?: string[]; exclude?: string[]; disable?: string[] } = {}) {
  let axe = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  for (const selector of options.include ?? []) axe = axe.include(selector);
  for (const selector of options.exclude ?? []) axe = axe.exclude(selector);
  if (options.disable?.length) axe = axe.disableRules(options.disable);
  const result = await axe.analyze();

  const info = test.info();
  await info.attach('axe-results', { body: JSON.stringify(result.violations, null, 2), contentType: 'application/json' });
  const line = (v: (typeof result.violations)[number]) =>
    `${v.id} (${v.impact}): ${v.help}, ${v.nodes.length} element(s): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(', ')}`;
  const blocking = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const minor = result.violations.filter((v) => !blocking.includes(v));
  if (minor.length) info.annotations.push({ type: 'a11y', description: minor.map(line).join('\n') });
  expect(blocking.map(line), `serious or critical accessibility issues on ${page.url()}`).toEqual([]);
}
