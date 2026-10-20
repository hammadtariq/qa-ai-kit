import { test, expect } from './fixtures';

// Seed for the Playwright planner and generator agents: it opens the app signed in
// (storage state from auth.setup.ts) so the agents start where real tests start.
test('seed', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/.*/);
});
