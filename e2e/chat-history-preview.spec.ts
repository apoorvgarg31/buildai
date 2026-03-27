import { test, expect } from '@playwright/test';

test('chat preview preserves history and session continuity after refresh', async ({ page }) => {
  const scopedSessionKey = 'agent:agent-preview:webchat:user-preview:default';
  const messagesBySession = new Map<string, Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: string }>>();
  messagesBySession.set(scopedSessionKey, []);

  let messageCounter = 0;
  let assistantCounter = 0;

  await page.route('**/api/chat', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok' }),
      });
      return;
    }

    const body = JSON.parse(request.postData() || '{}');
    const incomingMessage = String(body.message || '');
    const sessionId = String(body.sessionId || 'agent:agent-preview:webchat:default');
    const sessionKey = sessionId.includes('user-preview') ? sessionId : scopedSessionKey;
    const transcript = messagesBySession.get(sessionKey) || [];
    const userMessage = {
      id: `user-${++messageCounter}`,
      role: 'user' as const,
      content: incomingMessage,
      timestamp: new Date().toISOString(),
    };
    const assistantText = `Persisted reply ${++assistantCounter}: ${incomingMessage}`;
    const assistantMessage = {
      id: `assistant-${assistantCounter}`,
      role: 'assistant' as const,
      content: assistantText,
      timestamp: new Date().toISOString(),
    };
    messagesBySession.set(sessionKey, [...transcript, userMessage, assistantMessage]);

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: [
        `data: ${JSON.stringify({ type: 'delta', text: assistantText })}`,
        `data: ${JSON.stringify({ type: 'done', sessionId: sessionKey })}`,
        '',
      ].join('\n'),
    });
  });

  await page.route('**/api/chat/history**', async (route) => {
    const url = new URL(route.request().url());
    const requestedSessionId = url.searchParams.get('sessionId') || 'agent:agent-preview:webchat:default';
    const sessionKey = requestedSessionId.includes('user-preview') ? requestedSessionId : scopedSessionKey;
    const messages = messagesBySession.get(sessionKey) || [];

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessionKey,
        messages,
      }),
    });
  });

  await page.route('**/api/artifacts**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.goto('/preview/chat');

  await expect(page.getByRole('heading', { name: 'Mira chat' })).toBeVisible();

  const input = page.getByPlaceholder('Ask Mira anything about your project');
  await input.fill('First persisted question');
  await page.locator('button[title="Send message"]').click();

  await expect(page.getByText('First persisted question', { exact: true })).toBeVisible();
  await expect(page.getByText('Persisted reply 1: First persisted question', { exact: true })).toBeVisible();

  await page.reload();

  await expect(page.getByText('First persisted question', { exact: true })).toBeVisible();
  await expect(page.getByText('Persisted reply 1: First persisted question', { exact: true })).toBeVisible();

  await input.fill('Second persisted question');
  await page.locator('button[title="Send message"]').click();

  await expect(page.getByText('Second persisted question', { exact: true })).toBeVisible();
  await expect(page.getByText('Persisted reply 2: Second persisted question', { exact: true })).toBeVisible();

  await page.screenshot({ path: 'playwright-artifacts/chat-history-preview.png', fullPage: true });
});
