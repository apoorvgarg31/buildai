import { test, expect } from '@playwright/test';

test.describe('BuildAI Chat Interface', () => {

  test('should load the chat page', async ({ page }) => {
    await page.goto('/');
    
    // Should have the chat header
    await expect(page.locator('h2')).toContainText('Chat');
  });

  test('should display welcome message', async ({ page }) => {
    await page.goto('/');
    
    // Welcome message should be visible
    await expect(page.locator('text=BuildAI assistant')).toBeVisible();
    await expect(page.locator('text=construction PM copilot')).toBeVisible();
  });

  test('should show engine status badge', async ({ page }) => {
    await page.goto('/');
    
    // Should show Preview Mode or Connecting...
    const badge = page.locator('text=Preview Mode').or(page.locator('text=Connecting...'));
    await expect(badge.first()).toBeVisible();
  });

  test('should have chat input area', async ({ page }) => {
    await page.goto('/');
    
    const input = page.locator('textarea[placeholder*="Ask about"]');
    await expect(input).toBeVisible();
    await expect(input).toBeEnabled();
  });

  test('should have send button', async ({ page }) => {
    await page.goto('/');
    
    const sendButton = page.locator('button[title="Send message"]');
    await expect(sendButton).toBeVisible();
  });

  test('should send a message and get a response', async ({ page }) => {
    await page.goto('/');
    
    const input = page.locator('textarea[placeholder*="Ask about"]');
    await input.fill('Show me open RFIs');
    
    const sendButton = page.locator('button[title="Send message"]');
    await sendButton.click();
    
    // User message should appear in the messages area
    const messagesArea = page.locator('.overflow-y-auto');
    await expect(messagesArea.locator('text=Show me open RFIs')).toBeVisible({ timeout: 5000 });
    
    // Wait for assistant response — mock returns RFI content with this unique text
    await expect(messagesArea.locator('text=Engine not connected yet')).toBeVisible({ timeout: 5000 });
  });

  test('should have sidebar navigation', async ({ page }) => {
    await page.goto('/');
    
    // Check for sidebar elements
    await expect(page.locator('text=BuildAI').first()).toBeVisible();
  });

  test('chat API health check returns ok', async ({ request }) => {
    const response = await request.get('/api/chat');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.engine).toBeDefined();
  });

  test('chat API responds to POST', async ({ request }) => {
    const response = await request.post('/api/chat', {
      data: { message: 'test message' },
    });
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.response).toBeDefined();
    expect(data.sessionId).toBeDefined();
    expect(data.source).toBe('mock');
  });

  test('chat API returns 400 for empty message', async ({ request }) => {
    const response = await request.post('/api/chat', {
      data: { message: '' },
    });
    expect(response.status()).toBe(400);
  });
});
