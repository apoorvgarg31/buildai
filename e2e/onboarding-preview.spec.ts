import { test, expect } from '@playwright/test';

test('workspace onboarding preview renders the first-run experience', async ({ page }) => {
  await page.goto('/preview/onboarding');

  await expect(page.getByRole('heading', { name: 'Welcome to Mira command' })).toBeVisible();
  await expect(page.getByText('Apoorv, your Mira workspace starts with a clean security boundary.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create my workspace' })).toBeVisible();

  await page.screenshot({ path: 'playwright-artifacts/onboarding-preview.png', fullPage: true });
});
