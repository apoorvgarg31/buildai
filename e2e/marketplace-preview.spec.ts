import { test, expect } from '@playwright/test';

test('marketplace preview supports install, remove, and reinstall', async ({ page }) => {
  let installed = false;

  await page.route('**/api/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ agentId: 'agent-preview' }),
    });
  });

  await page.route('**/api/marketplace/skills**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    if (method === 'POST' && url.pathname.endsWith('/install')) {
      installed = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      return;
    }

    if (method === 'DELETE') {
      installed = false;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        categories: ['Documents'],
        skills: [
          {
            id: 'pdf',
            name: 'PDF Reader',
            description: 'Extracts project context from PDF uploads.',
            category: 'Documents',
            icon: '📄',
            vendor: 'Anthropic',
            version: '1.0.0',
            tags: ['pdf', 'documents'],
            readme: 'Use this skill to inspect PDF artifacts.',
            installed,
            installedByUser: installed,
            removableByUser: installed,
            installablePublic: !installed,
            requiresConnections: false,
            requirementsSatisfied: true,
            requirementStates: [],
          },
        ],
      }),
    });
  });

  await page.goto('/preview/marketplace');

  await expect(page.getByRole('heading', { name: 'Marketplace' })).toBeVisible();
  await expect(page.getByText('PDF Reader')).toBeVisible();

  await page.getByRole('button', { name: 'Install' }).click();
  await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();
  await page.screenshot({ path: 'playwright-artifacts/marketplace-installed-preview.png', fullPage: true });

  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('button', { name: 'Install' })).toBeVisible();

  await page.getByRole('button', { name: 'Install' }).click();
  await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();
  await page.screenshot({ path: 'playwright-artifacts/marketplace-reinstalled-preview.png', fullPage: true });
});
