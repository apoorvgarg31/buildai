import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { test, expect } from '@playwright/test';

type DbRow = Record<string, unknown>;

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  agent_id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AgentRow = {
  id: string;
  name: string;
  user_id: string | null;
  model?: string | null;
  api_key?: string | null;
  workspace_dir: string;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const ADMIN_EMAIL = 'mira.demo.admin@example.com';
const DB_PATH = path.join(process.cwd(), 'data', 'buildai-admin.db');
const ENGINE_DIR = path.join(process.cwd(), 'packages', 'engine');

function insertRow(db: Database.Database, table: string, row: DbRow) {
  const keys = Object.keys(row);
  const placeholders = keys.map(() => '?').join(', ');
  const columns = keys.join(', ');
  db.prepare(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`).run(...keys.map((key) => row[key]));
}

function resolveWorkspaceDir(workspaceDir: string): string {
  return path.isAbsolute(workspaceDir) ? workspaceDir : path.resolve(ENGINE_DIR, workspaceDir);
}

test.describe.serial('user first-run browser flow', () => {
  test('first user provisions automatically, completes onboarding, and gets a first response', async ({ page }) => {
    const db = new Database(DB_PATH);
    const originalUser = db.prepare('SELECT * FROM users WHERE email = ?').get(ADMIN_EMAIL) as UserRow | undefined;
    const originalAgent = originalUser?.agent_id
      ? db.prepare('SELECT * FROM agents WHERE id = ?').get(originalUser.agent_id) as AgentRow | undefined
      : undefined;

    expect(originalUser).toBeTruthy();

    const originalAgentId = originalAgent?.id || null;
    let restored = false;
    let provisionedAgentId = '';
    const sessionMessages = new Map<string, Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: string }>>();

    const restoreState = () => {
      if (restored || !originalUser) return;
      restored = true;
      db.prepare('DELETE FROM users WHERE email = ?').run(ADMIN_EMAIL);
      if (originalAgentId) {
        db.prepare('DELETE FROM agents WHERE id = ?').run(originalAgentId);
      }
      insertRow(db, 'users', originalUser as unknown as DbRow);
      if (originalAgent) {
        insertRow(db, 'agents', originalAgent as unknown as DbRow);
      }
    };

    try {
      db.prepare('DELETE FROM users WHERE email = ?').run(ADMIN_EMAIL);
      if (originalAgentId) {
        db.prepare('DELETE FROM agents WHERE id = ?').run(originalAgentId);
      }

      await page.route('**/api/chat/history**', async (route) => {
        const url = new URL(route.request().url());
        const sessionId = url.searchParams.get('sessionId') || `agent:${provisionedAgentId || 'pending'}:webchat:default`;
        const messages = sessionMessages.get(sessionId) || [];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ sessionKey: sessionId, messages }),
        });
      });

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

        const body = JSON.parse(request.postData() || '{}') as { message?: string; sessionId?: string };
        const text = String(body.message || '');
        const sessionId = body.sessionId || `agent:${provisionedAgentId}:webchat:default`;
        const messages = sessionMessages.get(sessionId) || [];
        const userMessage = {
          id: `user-${Date.now()}`,
          role: 'user' as const,
          content: text,
          timestamp: new Date().toISOString(),
        };
        const assistantText = `READY: ${text}`;
        const assistantMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant' as const,
          content: assistantText,
          timestamp: new Date().toISOString(),
        };
        sessionMessages.set(sessionId, [...messages, userMessage, assistantMessage]);

        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: [
            `data: ${JSON.stringify({ type: 'delta', text: assistantText })}`,
            `data: ${JSON.stringify({ type: 'done', sessionId })}`,
            '',
          ].join('\n'),
        });
      });

      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Welcome to Mira command', exact: true })).toBeVisible({ timeout: 30000 });
      await expect(page.getByText('Provision your personal agent', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Create my workspace', exact: true })).toBeVisible();

      await page.getByRole('button', { name: 'Create my workspace', exact: true }).click();
      await page.waitForURL('**/chat', { timeout: 30000 });
      await expect(page.getByRole('heading', { name: 'Mira chat', exact: true })).toBeVisible({ timeout: 30000 });

      const provisionedUser = db.prepare('SELECT * FROM users WHERE email = ?').get(ADMIN_EMAIL) as UserRow | undefined;
      expect(provisionedUser).toBeTruthy();
      expect(provisionedUser?.role).toBe('admin');
      expect(provisionedUser?.agent_id).toBeTruthy();
      provisionedAgentId = provisionedUser?.agent_id || '';

      const provisionedAgent = db.prepare('SELECT * FROM agents WHERE id = ?').get(provisionedAgentId) as AgentRow | undefined;
      expect(provisionedAgent).toBeTruthy();
      expect(provisionedAgent?.workspace_dir).toBeTruthy();
      expect(fs.existsSync(resolveWorkspaceDir(String(provisionedAgent?.workspace_dir || '')))).toBe(true);

      const input = page.getByPlaceholder('Ask Mira anything about your project');
      await input.fill('First onboarding message');
      await page.locator('button[title="Send message"]').click();

      await expect(page.getByText('First onboarding message', { exact: true })).toBeVisible({ timeout: 30000 });
      await expect(page.getByText('READY: First onboarding message', { exact: true })).toBeVisible({ timeout: 30000 });
    } finally {
      restoreState();
      db.close();
    }
  });
});
