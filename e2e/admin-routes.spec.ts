import { test, expect } from '@playwright/test';

const adminRoutes = [
  { path: '/admin/dashboard', heading: 'Admin command', screenshot: 'admin-dashboard-route.png' },
  { path: '/admin/users', heading: 'Users', screenshot: 'admin-users-route.png' },
  { path: '/admin/agents', heading: 'Agents', screenshot: 'admin-agents-route.png' },
  { path: '/admin/connectors', heading: 'Connectors', screenshot: 'admin-connectors-route.png' },
  { path: '/admin/tools', heading: 'Tools', screenshot: 'admin-tools-route.png' },
  { path: '/admin/mcp-servers', heading: 'MCP Servers', screenshot: 'admin-mcp-servers-route.png' },
  { path: '/admin/settings', heading: 'Admin settings', screenshot: 'admin-settings-route.png' },
] as const;

test.describe('admin route coverage', () => {
  for (const route of adminRoutes) {
    test(`loads ${route.path}`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`${route.path}$`));
      await expect(page.getByRole('heading', { name: route.heading, exact: true }).first()).toBeVisible({ timeout: 30000 });
      await page.screenshot({ path: `playwright-artifacts/${route.screenshot}`, fullPage: true });
    });
  }
});
