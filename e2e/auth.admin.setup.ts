import fs from 'node:fs';
import path from 'node:path';
import { test as setup, expect, Page } from '@playwright/test';

const authFile = path.join(process.cwd(), 'playwright-artifacts', '.auth', 'admin.json');

async function fillFirstVisible(page: Page, selectors: string[], value: string) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0) {
      try {
        if (await locator.isVisible({ timeout: 1000 })) {
          await locator.fill(value);
          return;
        }
      } catch {
        // try next selector
      }
    }
  }
  throw new Error(`Could not find visible input for selectors: ${selectors.join(', ')}`);
}

setup('authenticate admin user', async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('Missing E2E_ADMIN_EMAIL or E2E_ADMIN_PASSWORD for admin Playwright auth setup');
  }

  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });

  // Step 1: Enter email
  await expect(page.getByText('Email address').or(page.getByText('email', { exact: false }).first())).toBeVisible({ timeout: 30000 });

  await fillFirstVisible(page, [
    'input[name="identifier"]',
    'input[type="email"]',
    'input[autocomplete="username"]',
  ], email);

  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  // Step 2: Enter password (Clerk redirects to factor-one)
  const passwordInput = await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 15000 });

  await fillFirstVisible(page, [
    'input[name="password"]',
    'input[type="password"]',
    'input[autocomplete="current-password"]',
  ], password);

  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  // Step 3: Wait for successful redirect to app
  await page.waitForURL((url) => url.pathname !== '/sign-in' && !url.pathname.startsWith('/sign-in/factor'), { timeout: 30000 });

  // Navigate to admin dashboard and verify
  await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Admin command' })).toBeVisible({ timeout: 15000 });

  await page.context().storageState({ path: authFile });
});
