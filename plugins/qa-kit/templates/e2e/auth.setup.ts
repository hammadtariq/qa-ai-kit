import { test as setup, expect } from '@playwright/test';
import { qaRoles } from './roles';

// Logs in once per role (see roles.ts) and saves each session; every other test starts signed in.
// /qa-kit:setup-project adapts the locators below to the client's login page.
for (const role of qaRoles()) {
  setup(`authenticate as ${role.name}`, async ({ page }) => {
    const email = process.env[`${role.env}_EMAIL`];
    const password = process.env[`${role.env}_PASSWORD`];
    if (!email || !password) {
      throw new Error(`Set ${role.env}_EMAIL and ${role.env}_PASSWORD in .env (local) or as CI secrets.`);
    }

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // Replace with something only a signed-in user sees.
    await expect(page.getByRole('navigation')).toBeVisible();

    await page.context().storageState({ path: role.authFile });
  });
}
