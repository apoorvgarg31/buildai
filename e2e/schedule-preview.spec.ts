import { test, expect } from '@playwright/test';

test('schedule preview renders timezone-aware cron controls', async ({ page }) => {
  await page.goto('/preview/schedule');

  await expect(page.getByRole('heading', { name: 'Automation' })).toBeVisible();
  await expect(page.getByText(/Runs daily in/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create daily schedule' })).toBeVisible();

  await page.screenshot({ path: 'playwright-artifacts/schedule-preview.png', fullPage: true });
});
