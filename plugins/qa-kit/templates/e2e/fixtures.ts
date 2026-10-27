import { test as base, expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { qaRole } from './roles';

/**
 * Link a test to its TestRail case(s). The JUnit reporter turns this into
 * <property name="test_id" value="C123"/>, which trcli matches with --case-matcher property.
 *
 *   test('shows an error for an expired coupon', { annotation: tr('C1234'), tag: '@smoke' }, async ({ page }) => { ... });
 */
export function tr(...caseIds: Array<string | number>) {
  const ids = caseIds.map((id) => `C${String(id).replace(/^C/i, '')}`);
  return { type: 'test_id', description: ids.join(',') };
}

type QaFixtures = {
  /**
   * A page signed in as another role (roles in .qa/config.json), for cases about who may do what:
   *
   *   const staff = await asRole('staff');
   *   await staff.goto('/orders/A-17');
   *   await expect(staff.getByRole('button', { name: 'Refund' })).toHaveCount(0);
   */
  asRole: (role: string) => Promise<Page>;
  /**
   * A request context with a role's session, for "even a direct request is refused":
   *
   *   const res = await (await apiAs('staff')).post('/api/orders/A-17/refunds', { data: { amount: 100 } });
   *   expect(res.status()).toBe(403);
   *
   * It sends the role's cookies. For apps that sign API calls with a token instead, add the header here.
   */
  apiAs: (role: string) => Promise<APIRequestContext>;
  // Add shared fixtures here, for example an API client that seeds data:
  // api: ApiClient;
};

export const test = base.extend<QaFixtures>({
  asRole: async ({ browser, baseURL, contextOptions }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (role) => {
      const context = await browser.newContext({ ...contextOptions, baseURL, storageState: qaRole(role).authFile });
      contexts.push(context);
      return context.newPage();
    });
    await Promise.all(contexts.map((c) => c.close()));
  },
  apiAs: async ({ playwright, baseURL }, use) => {
    const contexts: APIRequestContext[] = [];
    await use(async (role) => {
      const context = await playwright.request.newContext({ baseURL, storageState: qaRole(role).authFile });
      contexts.push(context);
      return context;
    });
    await Promise.all(contexts.map((c) => c.dispose()));
  },
  // api: async ({ request }, use) => { await use(new ApiClient(request)); },
});

export { expect };
