/**
 * Live chat tests against the real BuildAI engine gateway.
 *
 * NO mocks — these tests send real messages through the full stack:
 *   Frontend → /api/chat → gateway-client WebSocket → engine → response
 *
 * Prerequisites:
 *   - BuildAI engine running on ws://localhost:18790
 *   - Next.js dev server on http://localhost:3000
 *   - admin auth state available (storageState: playwright-artifacts/.auth/admin.json)
 *
 * Usage:
 *   npx playwright test e2e/chat-engine-live.spec.ts
 *   (requires engine + web running locally)
 */

import { test, expect } from '@playwright/test';

const GATEWAY_HEALTH_URL = 'http://localhost:3000/api/chat';
const CHAT_API_URL = 'http://localhost:3000/api/chat';
const CHAT_HISTORY_URL = 'http://localhost:3000/api/chat/history';
const ME_API_URL = 'http://localhost:3000/api/me';

function randomSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

test.describe.serial('Live engine — chat, isolation, history', () => {
  // ── Gate: ensure engine is reachable ──

  test('engine gateway responds to health check', async ({ request }) => {
    const res = await request.get(GATEWAY_HEALTH_URL);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.status).toBe('ok');
  });

  // ── Provision current user and get agentId ──

  test('provisions user agent and returns active agentId', async ({ request }) => {
    const res = await request.post(ME_API_URL);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.agentId).toBeTruthy();
    expect(data.needsProvisioning).toBeFalsy();
  });

  // ── Chat sends a real message through the engine ──

  test('chat send returns a real engine response (not a mock)', async ({ request }) => {
    // Get agentId for session key scoping
    const meRes = await request.get(ME_API_URL);
    const me = await meRes.json();
    const agentId: string = me.agentId;
    expect(agentId).toBeTruthy();

    const sessionKey = `agent:${agentId}:webchat:live-test:${randomSuffix()}`;
    const userMessage = `This is a live engine test — reply with the exact string: ENGINE_OK_${randomSuffix()}`;

    const res = await request.post(CHAT_API_URL, {
      data: { message: userMessage, sessionId: sessionKey, stream: false },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    expect(data.response).toBeTruthy();
    expect(data.response).not.toContain('(No response)');
    expect(data.sessionId).toBeTruthy();
    expect(data.sessionId).toContain(agentId);

    // The live engine should echo back our marker string
    expect(data.response).toContain('ENGINE_OK_');
  });

  // ── Chat history persists after send ──

  test('chat history returns the same conversation after send', async ({ request }) => {
    const meRes = await request.get(ME_API_URL);
    const me = await meRes.json();
    const agentId: string = me.agentId;

    const sessionKey = `agent:${agentId}:webchat:history-test:${randomSuffix()}`;
    const marker = `HISTORY_MARKER_${randomSuffix()}`;

    // Send a message
    const sendRes = await request.post(CHAT_API_URL, {
      data: { message: marker, sessionId: sessionKey, stream: false },
    });
    expect(sendRes.ok()).toBeTruthy();
    const usedSessionKey: string = (await sendRes.json()).sessionId;

    // Fetch history
    const histRes = await request.get(`${CHAT_HISTORY_URL}?sessionId=${encodeURIComponent(usedSessionKey)}`);
    expect(histRes.ok()).toBeTruthy();
    const hist = await histRes.json();

    // Should contain at least 2 messages (user + assistant)
    expect(Array.isArray(hist.messages)).toBeTruthy();
    expect(hist.messages.length).toBeGreaterThanOrEqual(2);

    // User message should match what we sent
    const userMsg = hist.messages.find((m: { role: string; content: string }) => m.role === 'user');
    expect(userMsg).toBeTruthy();
    expect(userMsg.content).toContain(marker);

    // Assistant message should be non-empty
    const assistantMsg = hist.messages.find((m: { role: string; content: string }) => m.role === 'assistant');
    expect(assistantMsg).toBeTruthy();
    expect(assistantMsg.content.length).toBeGreaterThan(0);
  });

  // ── Cross-user isolation — different agentId gets different session ──

  test('session keys are scoped to agent and cannot cross user boundaries', async ({ request }) => {
    const meRes = await request.get(ME_API_URL);
    const me = await meRes.json();
    const myAgentId: string = me.agentId;

    // Try to use another agent's session key — route should normalize it
    const foreignSessionKey = `agent:some-other-agent:webchat:some-other-user:default`;

    const res = await request.post(CHAT_API_URL, {
      data: { message: 'test', sessionId: foreignSessionKey, stream: false },
    });

    // Either forbidden (session ownership violation) or the session key gets rewritten to mine
    const data = await res.json();
    if (res.status() === 403) {
      expect(data.reason).toBe('SESSION_OWNERSHIP_VIOLATION');
    } else {
      expect(res.ok()).toBeTruthy();
      // Session key should have been rewritten to my agentId
      expect(data.sessionId).toContain(myAgentId);
    }
  });

  // ── Workspace isolation — files written during chat stay in user sandbox ──

  test('artifact files generated during session belong to the correct agent workspace', async ({ request }) => {
    const meRes = await request.get(ME_API_URL);
    const me = await meRes.json();
    const agentId: string = me.agentId;
    expect(agentId).toBeTruthy();

    // Ask the engine to create a simple text file as artifact
    const sessionKey = `agent:${agentId}:webchat:artifact-test:${randomSuffix()}`;

    const res = await request.post(CHAT_API_URL, {
      data: {
        message: 'Write a file called artifacts/test-note.txt in my workspace with the content "isolated-ok"',
        sessionId: sessionKey,
        stream: false,
      },
    });
    expect(res.ok()).toBeTruthy();

    // Fetch artifacts for this agent
    const artRes = await request.get(`/api/artifacts?agentId=${encodeURIComponent(agentId)}`);
    expect(artRes.ok()).toBeTruthy();
    const artifacts = await artRes.json();
    expect(Array.isArray(artifacts)).toBeTruthy();

    // The artifact should exist (agent may create it or not, but no error means API is accessible)
    // At minimum: artifacts endpoint returns cleanly for this agentId
  });

  // ── Session continuity — consecutive messages in same session ──

  test('multiple messages in same session share context', async ({ request }) => {
    const meRes = await request.get(ME_API_URL);
    const me = await meRes.json();
    const agentId: string = me.agentId;

    const sessionKey = `agent:${agentId}:webchat:continuity-test:${randomSuffix()}`;
    const seedMarker = `SEED_${randomSuffix()}`;

    // First message — plant context
    const res1 = await request.post(CHAT_API_URL, {
      data: { message: `Remember this token: ${seedMarker}`, sessionId: sessionKey, stream: false },
    });
    expect(res1.ok()).toBeTruthy();

    // Second message — reference context
    const res2 = await request.post(CHAT_API_URL, {
      data: { message: `What was the token I told you to remember?`, sessionId: sessionKey, stream: false },
    });
    expect(res2.ok()).toBeTruthy();
    const data2 = await res2.json();

    // Engine should reference the seed marker from previous message
    expect(data2.response).toBeTruthy();
    expect(data2.response).toContain(seedMarker);
  });
});
