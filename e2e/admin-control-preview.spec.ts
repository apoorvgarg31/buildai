import { test, expect } from '@playwright/test';

test('admin control preview renders tools and mcp server screens', async ({ page }) => {
  await page.goto('/preview/admin-control');

  await expect(page.getByRole('heading', { name: 'Tools', exact: true })).toBeVisible();
  await expect(page.getByText('Web fetch')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'MCP Servers', exact: true })).toBeVisible();
  await expect(page.getByText('Linear MCP')).toBeVisible();

  await page.screenshot({ path: 'playwright-artifacts/admin-tools-page.png', fullPage: true });

  await page.getByRole('heading', { name: 'MCP Servers', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'playwright-artifacts/admin-mcp-servers-page.png', fullPage: true });
});
