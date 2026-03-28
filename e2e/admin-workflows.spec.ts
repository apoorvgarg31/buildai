import { test, expect, Page } from '@playwright/test';

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function confirmNextDialog(page: Page) {
  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });
}

async function deleteRowByText(page: Page, text: string) {
  const row = page.locator('tr').filter({ hasText: text }).first();
  await expect(row).toBeVisible({ timeout: 30000 });
  await confirmNextDialog(page);
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(row).toHaveCount(0, { timeout: 30000 });
}

async function deleteCardByText(page: Page, text: string) {
  const card = page.locator('div').filter({ hasText: text }).filter({ has: page.getByRole('button', { name: 'Delete', exact: true }) }).first();
  await expect(card).toBeVisible({ timeout: 30000 });
  await confirmNextDialog(page);
  await card.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText(text, { exact: true })).toHaveCount(0, { timeout: 30000 });
}

test.describe.serial('admin workflow coverage', () => {
  test('creates and deletes a user from the admin users screen', async ({ page }) => {
    const suffix = uniqueSuffix();
    const name = `Playwright Admin User ${suffix}`;
    const email = `playwright-admin-${suffix}@example.com`;

    await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Add user', exact: true }).click();
    await expect(page.getByText('Add a teammate', { exact: true })).toBeVisible({ timeout: 30000 });

    const modal = page.locator('div').filter({ has: page.getByText('Add a teammate', { exact: true }) }).last();
    await modal.locator('input[placeholder="Jane Smith"]').fill(name);
    await modal.locator('input[placeholder="jane@company.com"]').fill(email);
    await modal.locator('select').first().selectOption('user');

    const createResponse = page.waitForResponse((response) => response.url().includes('/api/admin/users') && response.request().method() === 'POST');
    await modal.getByRole('button', { name: 'Add user', exact: true }).click();
    await expect((await createResponse).ok()).toBeTruthy();

    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 30000 });
    await deleteRowByText(page, name);
  });

  test('creates and deletes a connector from the admin connectors screen', async ({ page }) => {
    const suffix = uniqueSuffix();
    const name = `Playwright DB ${suffix}`;

    await page.goto('/admin/connectors', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Add connector', exact: true }).click();
    await expect(page.getByText('Add a supported enterprise application', { exact: true })).toBeVisible({ timeout: 30000 });

    const modal = page.locator('div').filter({ has: page.getByText('Add a supported enterprise application', { exact: true }) }).last();
    await modal.locator('input[placeholder="Project Database"]').fill(name);
    await modal.locator('select').nth(0).selectOption('database');
    await modal.locator('select').nth(1).selectOption('shared');
    await modal.locator('input[placeholder="localhost"]').fill('localhost');
    await modal.locator('input[placeholder="5432"]').fill('5432');
    await modal.locator('input[placeholder="mira_demo"]').fill('mira_demo');
    await modal.locator('input[placeholder="db_user"]').fill('demo_user');
    await modal.locator('input[type="password"]').fill('demo_password');

    const createResponse = page.waitForResponse((response) => response.url().includes('/api/admin/connections') && response.request().method() === 'POST');
    await modal.getByRole('button', { name: 'Add connection', exact: true }).click();
    await expect((await createResponse).ok()).toBeTruthy();

    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 30000 });
    await deleteCardByText(page, name);
  });

  test('toggles a tool and persists the state after refresh', async ({ page }) => {
    await page.goto('/admin/tools', { waitUntil: 'domcontentloaded' });

    const checkbox = page.getByLabel('Enable Read');
    await expect(checkbox).toBeVisible({ timeout: 30000 });

    const original = await checkbox.isChecked();
    const target = !original;
    const updateResponse = page.waitForResponse((response) => response.url().includes('/api/admin/tools/read') && response.request().method() === 'PUT');
    await checkbox.click();
    await expect((await updateResponse).ok()).toBeTruthy();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Enable Read')).toHaveJSProperty('checked', target);

    const restoreResponse = page.waitForResponse((response) => response.url().includes('/api/admin/tools/read') && response.request().method() === 'PUT');
    await page.getByLabel('Enable Read').click();
    await expect((await restoreResponse).ok()).toBeTruthy();
  });

  test('creates and deletes a standalone MCP server', async ({ page }) => {
    const suffix = uniqueSuffix();
    const name = `Playwright MCP ${suffix}`;

    await page.goto('/admin/mcp-servers', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Add MCP server', exact: true }).click();
    await expect(page.getByText('Register a runtime server', { exact: true })).toBeVisible({ timeout: 30000 });

    const modal = page.locator('div').filter({ has: page.getByText('Register a runtime server', { exact: true }) }).last();
    await modal.locator('select').nth(0).selectOption('standalone');
    await modal.locator('input[placeholder="Linear MCP"]').fill(name);
    await modal.locator('select').nth(1).selectOption('stdio');
    await modal.locator('input[placeholder="npx"]').fill('npx');
    await modal.locator('input[placeholder="@vendor/server --flag"]').fill('@modelcontextprotocol/server-memory');
    await modal.locator('textarea').fill('Created by Playwright admin workflow test.');

    const createResponse = page.waitForResponse((response) => response.url().includes('/api/admin/mcp-servers') && response.request().method() === 'POST');
    await modal.getByRole('button', { name: 'Create server', exact: true }).click();
    await expect((await createResponse).ok()).toBeTruthy();

    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 30000 });
    await deleteCardByText(page, name);
  });
});
