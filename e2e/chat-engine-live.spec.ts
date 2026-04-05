/**
 * Live engine tests — browser-driven API tests with real Clerk session.
 *
 * Uses a real browser page with admin auth so Clerk JS client refreshes
 * session tokens automatically. Then makes API calls via page.evaluate()
 * using fetch() in the browser context (which includes fresh cookies).
 *
 * Prerequisites:
 *   - Next.js on http://localhost:3000
 *   - playwright-artifacts/.auth/admin.json populated
 *   - ENGINE running (for chat tests) optional
 *
 * Usage:
 *   PLAYWRIGHT_USE_EXISTING_SERVER=1 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... \
 *     npx playwright test e2e/chat-engine-live.spec.ts --project engine-live
 */

import { test, expect } from '@playwright/test';

const API = 'http://localhost:3000';

function apiFetch(page: any, method: string, path: string, data?: any) {
  return page.evaluate(
    ({ method, path, data }) => {
      const options: any = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (data) options.body = JSON.stringify(data);
      return fetch(path, options).then((r) =>
        r.json()
          .then((json) => ({ status: r.status, ok: r.ok, data: json }))
          .catch(() => ({ status: r.status, ok: r.ok, data: null })),
      );
    },
    { method, path: `${API}${path}`, data },
  );
}

function randomSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

test.describe('Live engine — real chat, isolation, history', () => {
  test.describe.configure({ mode: 'serial' });

  // Navigate to admin dashboard first so Clerk JS client refreshes the session
  test.beforeEach(async ({ page }) => {
    await page.goto(`${API}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000); // give Clerk time to refresh session
  });

  test('engine gateway health', async ({ page }) => {
    const result = await apiFetch(page, 'GET', '/api/chat');
    expect(result.ok).toBeTruthy();
    expect(result.data.status).toBe('ok');
  });

  test('admin provisions agent via /api/me POST', async ({ page }) => {
    const result = await apiFetch(page, 'POST', '/api/me');
    expect(result.ok).toBeTruthy();
    expect(result.data.agentId).toBeTruthy();
    expect(result.data.needsProvisioning).toBeFalsy();
  });

  test('real chat send → engine responds (not mock)', async ({ page }) => {
    const me = await apiFetch(page, 'GET', '/api/me');
    expect(me.data.agentId).toBeTruthy();

    const sessionKey = `agent:${me.data.agentId}:webchat:admin:engine-test-${randomSuffix()}`;
    const marker = `ENGINE_LIVE_${randomSuffix()}`;

    const result = await apiFetch(page, 'POST', '/api/chat', {
      message: `Reply with exactly: ${marker}`,
      sessionId: sessionKey,
      stream: false,
    });
    expect(result.ok).toBeTruthy();
    expect(result.data.response).toBeTruthy();
    expect(result.data.response).not.toBe('(No response)');
    expect(typeof result.data.response).toBe('string');
  });

  test('chat context persists across two turns', async ({ page }) => {
    const me = await apiFetch(page, 'GET', '/api/me');
    const sessionKey = `agent:${me.data.agentId}:webchat:admin:continuity-${randomSuffix()}`;
    const seed = `CONTEXT_SEED_${randomSuffix()}`;

    // Turn 1
    await apiFetch(page, 'POST', '/api/chat', {
      message: `Remember this: ${seed}`,
      sessionId: sessionKey,
      stream: false,
    });

    // Turn 2
    const result = await apiFetch(page, 'POST', '/api/chat', {
      message: `What did I tell you to remember?`,
      sessionId: sessionKey,
      stream: false,
    });
    expect(result.ok).toBeTruthy();
    expect(result.data.response).toContain(seed);
  });

  test('chat history retrievable and accurate (with session key normalization)', async ({ page }) => {
    const me = await apiFetch(page, 'GET', '/api/me');
    const sessionKey = `agent:${me.data.agentId}:webchat:admin:history-${randomSuffix()}`;
    const msg = `History marker: ${randomSuffix()}`;

    const chatRes = await apiFetch(page, 'POST', '/api/chat', {
      message: msg,
      sessionId: sessionKey,
      stream: false,
    });
    expect(chatRes.ok).toBeTruthy();
    const returnedSessionKey = chatRes.data?.sessionId || sessionKey;

    let result = { ok: false, data: { messages: [] }, status: 500 };
    for (let i = 0; i < 5; i++) {
      result = await apiFetch(page, 'GET', `/api/chat/history?sessionId=${encodeURIComponent(returnedSessionKey)}`);
      if (result.ok && result.data.messages && result.data.messages.length > 0) break;
      await page.waitForTimeout(1000);
    }

    expect(result.ok).toBeTruthy();
    expect(Array.isArray(result.data.messages)).toBeTruthy();
    expect(result.data.messages.length).toBeGreaterThanOrEqual(1);
    const userMsg = result.data.messages.find((m: { role: string }) => m.role === 'user');
    expect(userMsg).toBeTruthy();
    expect(userMsg.content).toContain(msg);
  });

  test('session key enforcement — foreign agent blocked or rewritten', async ({ page }) => {
    const me = await apiFetch(page, 'GET', '/api/me');
    const agentId = me.data.agentId;

    const result = await apiFetch(page, 'POST', '/api/chat', {
      message: 'test',
      sessionId: 'agent:foreign-agent:webchat:other-user:default',
      stream: false,
    });

    if (result.status === 403) {
      expect(result.data.reason).toBe('SESSION_OWNERSHIP_VIOLATION');
    } else {
      expect(result.ok).toBeTruthy();
      expect(result.data.sessionId).toContain(agentId);
    }
  });

  test('admin stats endpoint', async ({ page }) => {
    const result = await apiFetch(page, 'GET', '/api/admin/stats');
    expect(result.ok).toBeTruthy();
    expect(result.data.users).toBeDefined();
    expect(result.data.agents).toBeDefined();
  });

  test('marketplace catalog loads', async ({ page }) => {
    const result = await apiFetch(page, 'GET', '/api/marketplace/skills');
    expect(result.ok).toBeTruthy();
    expect(Array.isArray(result.data?.skills)).toBeTruthy();
    expect(result.data.skills.length).toBeGreaterThan(0);
  });

  test('watchlist API', async ({ page }) => {
    const result = await apiFetch(page, 'GET', '/api/watchlist');
    expect(result.ok).toBeTruthy();
  });

  test('schedule API', async ({ page }) => {
    const result = await apiFetch(page, 'GET', '/api/schedule');
    expect(result.ok).toBeTruthy();
  });

  test('agent connections API', async ({ page }) => {
    const result = await apiFetch(page, 'GET', '/api/agent/connections');
    expect(result.ok).toBeTruthy();
  });

  test('admin tools API', async ({ page }) => {
    const result = await apiFetch(page, 'GET', '/api/admin/tools');
    expect(result.ok).toBeTruthy();
  });

  test('admin MCP servers API', async ({ page }) => {
    const result = await apiFetch(page, 'GET', '/api/admin/mcp-servers');
    expect(result.ok).toBeTruthy();
  });

  test('personality settings', async ({ page }) => {
    const me = await apiFetch(page, 'GET', '/api/me');
    const result = await apiFetch(page, 'POST', '/api/personality/recommendations', {
      agentId: me.data.agentId,
      role: 'project manager',
      systems: ['Procore'],
      painPoints: ['rfis'],
    });
    expect(result.ok).toBeTruthy();
  });

  test('artifacts endpoint', async ({ page }) => {
    const me = await apiFetch(page, 'GET', '/api/me');
    const result = await apiFetch(page, 'GET', `/api/artifacts?agentId=${encodeURIComponent(me.data.agentId)}`);
    expect(result.ok).toBeTruthy();
  });
});
