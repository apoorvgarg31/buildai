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
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: text, exact: true }) }).first();
  await expect(card).toBeVisible({ timeout: 30000 });
  await confirmNextDialog(page);
  await card.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('heading', { name: text, exact: true })).toHaveCount(0, { timeout: 30000 });
}

test.describe.serial('admin workflow coverage', () => {
  test('creates, promotes, and deletes a user from the admin users screen', async ({ page }) => {
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

    const row = page.locator('tr').filter({ hasText: name }).first();
    await expect(row).toBeVisible({ timeout: 30000 });

    const promoteResponse = page.waitForResponse((response) => response.url().includes('/api/admin/users/') && response.request().method() === 'PUT');
    await row.getByLabel(`Role for ${name}`).selectOption('admin');
    await expect((await promoteResponse).ok()).toBeTruthy();
    await expect(row.getByLabel(`Role for ${name}`)).toHaveValue('admin');

    await deleteRowByText(page, name);
  });

  test('blocks demoting the last remaining admin from the users screen', async ({ page }) => {
    await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });

    const row = page.locator('tr').filter({ hasText: 'mira.demo.admin@example.com' }).first();
    await expect(row).toBeVisible({ timeout: 30000 });

    const updateResponse = page.waitForResponse((response) => response.url().includes('/api/admin/users/') && response.request().method() === 'PUT');
    await row.getByLabel('Role for Mira Admin').selectOption('user');
    const response = await updateResponse;

    expect(response.status()).toBe(409);
    await expect(page.getByText('At least one admin must remain', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(row.getByLabel('Role for Mira Admin')).toHaveValue('admin');
  });

  test('creates and deletes an agent from the admin agents screen', async ({ page }) => {
    const suffix = uniqueSuffix();
    const name = `Playwright Agent ${suffix}`;

    await page.goto('/admin/agents', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Create agent', exact: true }).click();
    await expect(page.getByText('Create a Mira worker', { exact: true })).toBeVisible({ timeout: 30000 });

    const modal = page.locator('div').filter({ has: page.getByText('Create a Mira worker', { exact: true }) }).last();
    await modal.locator('input[placeholder="Sarah\'s PM Agent"]').fill(name);
    await modal.locator('input[type="password"]').fill(`sk-demo-${suffix}`);

    const createResponse = page.waitForResponse((response) => response.url().includes('/api/admin/agents') && response.request().method() === 'POST');
    await modal.getByRole('button', { name: 'Create agent', exact: true }).click();
    await expect((await createResponse).ok()).toBeTruthy();

    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 30000 });
    await deleteCardByText(page, name);
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
    const updateResponse = page.waitForResponse((response) => response.url().includes('/api/admin/tools/read') && response.request().method() === 'PUT');
    await checkbox.click();
    await expect((await updateResponse).ok()).toBeTruthy();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Enable Read')).toHaveJSProperty('checked', !original);

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

  test('saves admin settings and reloads persisted values', async ({ page }) => {
    const suffix = uniqueSuffix();
    const companyName = `Mira QA ${suffix}`;

    await page.goto('/admin/settings', { waitUntil: 'domcontentloaded' });

    const originalCompany = await page.getByLabel('Company name').inputValue();
    const originalModel = await page.getByLabel('Default LLM model').inputValue();
    const originalQueries = await page.locator('#max-queries').inputValue();

    const saveResponse = page.waitForResponse((response) => response.url().includes('/api/admin/settings') && response.request().method() === 'PUT');
    await page.getByLabel('Company name').fill(companyName);
    await page.getByLabel('Default LLM model').selectOption('openai/gpt-4o');
    await page.locator('#max-queries').fill('321');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect((await saveResponse).ok()).toBeTruthy();
    await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible({ timeout: 30000 });

    const reloadResponse = page.waitForResponse((response) => response.url().includes('/api/admin/settings') && response.request().method() === 'GET');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await reloadResponse;
    await expect(page.getByLabel('Company name')).toHaveValue(companyName);
    await expect(page.getByLabel('Default LLM model')).toHaveValue('openai/gpt-4o');
    await expect(page.locator('#max-queries')).toHaveValue('321');

    const restoreResponse = page.waitForResponse((response) => response.url().includes('/api/admin/settings') && response.request().method() === 'PUT');
    await page.getByLabel('Company name').fill(originalCompany);
    await page.getByLabel('Default LLM model').selectOption(originalModel);
    await page.locator('#max-queries').fill(originalQueries);
    await page.getByRole('button', { name: /Save changes|Saved/ }).click();
    await expect((await restoreResponse).ok()).toBeTruthy();
  });
});
