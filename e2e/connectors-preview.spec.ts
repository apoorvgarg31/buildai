import { test, expect } from '@playwright/test';

test('connectors preview exposes connect and reconnect auth handoffs', async ({ page }) => {
  await page.route('**/api/agent/connections', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        agentId: 'agent-preview',
        connections: [
          {
            id: 'conn-linear',
            name: 'Linear Workspace',
            type: 'linear',
            status: 'connected',
            authMode: 'oauth_user',
            userAuthorized: false,
            readyForUse: false,
            requiresUserAuth: true,
            blockedReason: 'user_auth_required',
            statusLabel: 'Needs sign-in',
            actionLabel: 'Connect account',
            authUrl: '/api/connectors/mock-auth?connectionId=conn-linear',
          },
          {
            id: 'conn-procore',
            name: 'Procore Production',
            type: 'procore',
            status: 'connected',
            authMode: 'oauth_user',
            userAuthorized: false,
            readyForUse: false,
            requiresUserAuth: true,
            tokenExpired: true,
            reconnectRequired: true,
            blockedReason: 'reconnect_required',
            statusLabel: 'Reconnect required',
            actionLabel: 'Reconnect account',
            authUrl: '/api/connectors/mock-auth?connectionId=conn-procore',
          },
        ],
      }),
    });
  });

  await page.route('**/api/connectors/mock-auth?**', async (route) => {
    const url = new URL(route.request().url());
    const connectionId = url.searchParams.get('connectionId') || 'unknown';
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<html><body><h1>Connector handoff ready</h1><p>${connectionId}</p></body></html>`,
    });
  });

  await page.goto('/preview/connectors');

  await expect(page.getByRole('heading', { name: 'Connectors' })).toBeVisible();
  await expect(page.getByText('Linear Workspace')).toBeVisible();
  await expect(page.getByText('Procore Production')).toBeVisible();
  await expect(page.getByText('Needs sign-in')).toBeVisible();
  await expect(page.getByText('Reconnect required')).toBeVisible();

  await page.screenshot({ path: 'playwright-artifacts/connectors-preview.png', fullPage: true });

  await page.getByRole('link', { name: 'Connect account' }).click();
  await expect(page.getByRole('heading', { name: 'Connector handoff ready' })).toBeVisible();
  await expect(page.getByText('conn-linear')).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('link', { name: 'Reconnect account' })).toBeVisible();
  await page.getByRole('link', { name: 'Reconnect account' }).click();
  await expect(page.getByRole('heading', { name: 'Connector handoff ready' })).toBeVisible();
  await expect(page.getByText('conn-procore')).toBeVisible();
});
