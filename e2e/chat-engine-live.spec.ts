/**
 * Live engine tests — hit the real BuildAI engine (no mocks).
 *
 * Tests the full stack: Next.js API → WebSocket gateway → LLM → response
 * Uses real admin auth from playwright-artifacts/.auth/admin.json
 *
 * Prerequisites:
 *   - Engine running on ws://localhost:18790
 *   - Next.js on http://localhost:3000
 *   - playwright-artifacts/.auth/admin.json populated
 *
 * Usage:
 *   PLAYWRIGHT_USE_EXISTING_SERVER=1 npx playwright test e2e/chat-engine-live.spec.ts --project engine-live
 */

import { test, expect } from '@playwright/test';

const API = 'http://localhost:3000';

function randomSuffix() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

test.describe('Live engine — real chat, isolation, history', () => {

  test('engine gateway health', async ({ request }) => {
    const res = await request.get(`${API}/api/chat`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.status).toBe('ok');
  });

  test('admin provisions agent via /api/me POST', async ({ request }) => {
    const res = await request.post(`${API}/api/me`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.agentId).toBeTruthy();
    expect(data.needsProvisioning).toBeFalsy();
  });

  test('real chat send → engine responds (not mock)', async ({ page }) => {
    // Get agentId
    const meRes = await page.request.get(`${API}/api/me`);
    const me = await meRes.json() as { agentId: string };
    expect(me.agentId).toBeTruthy();

    const sessionKey = `agent:${me.agentId}:webchat:admin:engine-test-${randomSuffix()}`;
    const marker = `ENGINE_LIVE_${randomSuffix()}`;

    const res = await page.request.post(`${API}/api/chat`, {
      data: { message: `Reply with exactly: ${marker}`, sessionId: sessionKey, stream: false },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json() as { response: string; sessionId: string };

    expect(data.response).toBeTruthy();
    expect(data.response).not.toBe('(No response)');
    expect(data.response).toContain(marker);
  });

  test('chat context persists across two turns', async ({ page }) => {
    const meRes = await page.request.get(`${API}/api/me`);
    const me = await meRes.json() as { agentId: string };
    const sessionKey = `agent:${me.agentId}:webchat:admin:continuity-${randomSuffix()}`;
    const seed = `CONTEXT_SEED_${randomSuffix()}`;

    // Turn 1
    await page.request.post(`${API}/api/chat`, {
      data: { message: `Remember this: ${seed}`, sessionId: sessionKey, stream: false },
    });

    // Turn 2
    const res2 = await page.request.post(`${API}/api/chat`, {
      data: { message: `What did I tell you to remember?`, sessionId: sessionKey, stream: false },
    });
    expect(res2.ok()).toBeTruthy();
    const data2 = await res2.json() as { response: string };
    expect(data2.response).toContain(seed);
  });

  test('chat history retrievable and accurate', async ({ page }) => {
    const meRes = await page.request.get(`${API}/api/me`);
    const me = await meRes.json() as { agentId: string };
    const sessionKey = `agent:${me.agentId}:webchat:admin:history-${randomSuffix()}`;
    const msg = `History marker: ${randomSuffix()}`;

    await page.request.post(`${API}/api/chat`, {
      data: { message: msg, sessionId: sessionKey, stream: false },
    });

    const histRes = await page.request.get(`${API}/api/chat/history?sessionId=${encodeURIComponent(sessionKey)}`);
    expect(histRes.ok()).toBeTruthy();
    const hist = await histRes.json();
    expect(Array.isArray(hist.messages)).toBeTruthy();
    expect(hist.messages.length).toBeGreaterThanOrEqual(2);
    const userMsg = hist.messages.find((m: { role: string }) => m.role === 'user');
    expect(userMsg).toBeTruthy();
    expect(userMsg.content).toContain(msg);
  });

  test('session key enforcement — foreign agent blocked or rewritten', async ({ page }) => {
    const meRes = await page.request.get(`${API}/api/me`);
    const me = await meRes.json() as { agentId: string };

    const res = await page.request.post(`${API}/api/chat`, {
      data: { message: 'test', sessionId: 'agent:foreign-agent:webchat:other-user:default', stream: false },
    });

    if (res.status() === 403) {
      const body = await res.json();
      expect(body.reason).toBe('SESSION_OWNERSHIP_VIOLATION');
    } else {
      expect(res.ok()).toBeTruthy();
      const data = await res.json();
      expect(data.sessionId).toContain(me.agentId);
    }
  });

  test('admin stats endpoint', async ({ page }) => {
    const res = await page.request.get(`${API}/api/admin/stats`);
    expect(res.ok()).toBeTruthy();
    const stats = await res.json();
    expect(stats.users).toBeDefined();
    expect(stats.agents).toBeDefined();
  });

  test('marketplace catalog loads', async ({ page }) => {
    const res = await page.request.get(`${API}/api/marketplace/skills`);
    expect(res.ok()).toBeTruthy();
    const skills = await res.json();
    expect(Array.isArray(skills)).toBeTruthy();
    expect(skills.length).toBeGreaterThan(0);
  });

  test('watchlist API', async ({ page }) => {
    const res = await page.request.get(`${API}/api/watchlist`);
    expect(res.ok()).toBeTruthy();
  });

  test('schedule API', async ({ page }) => {
    const res = await page.request.get(`${API}/api/schedule`);
    expect(res.ok()).toBeTruthy();
  });

  test('agent connections API', async ({ page }) => {
    const res = await page.request.get(`${API}/api/agent/connections`);
    expect(res.ok()).toBeTruthy();
  });

  test('admin tools API', async ({ page }) => {
    const res = await page.request.get(`${API}/api/admin/tools`);
    expect(res.ok()).toBeTruthy();
  });

  test('admin MCP servers API', async ({ page }) => {
    const res = await page.request.get(`${API}/api/admin/mcp-servers`);
    expect(res.ok()).toBeTruthy();
  });
});
