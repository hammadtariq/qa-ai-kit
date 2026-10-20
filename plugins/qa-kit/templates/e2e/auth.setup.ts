import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

// Logs in once and saves the session; every other test starts signed in.
// /qa-kit:setup-project adapts the locators below to the client's login page.
setup('authenticate', async ({ page }) => {
  const email = process.env.QA_USER_EMAIL;
  const password = process.env.QA_USER_PASSWORD;
  if (!email || !password) {
    throw new Error('Set QA_USER_EMAIL and QA_USER_PASSWORD in .env (local) or as CI secrets.');
  }

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  // Replace with something only a signed-in user sees.
  await expect(page.getByRole('navigation')).toBeVisible();

  await page.context().storageState({ path: authFile });
});
