import { beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';

let mockUserId: string | null = 'user-1';
let mockClerkUser: Record<string, unknown> | null = {
  id: 'user-1',
  fullName: 'Test User',
  firstName: 'Test',
  emailAddresses: [{ emailAddress: 'user@example.com' }],
};

let testDb: InstanceType<typeof Database>;

const provisionWorkspaceMock = vi.hoisted(() => vi.fn(async (agentId: string) => `../../workspaces/${agentId}`));
const workspaceExistsMock = vi.hoisted(() => vi.fn(() => false));
const addAgentToConfigMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: mockUserId })),
  currentUser: vi.fn(async () => mockClerkUser),
}));

vi.mock('@/lib/admin-db-server', () => ({
  getDb: () => testDb,
}));

vi.mock('@/lib/workspace-provisioner', () => ({
  provisionWorkspace: provisionWorkspaceMock,
  workspaceExists: workspaceExistsMock,
}));

vi.mock('@/lib/engine-config', () => ({
  addAgentToConfig: addAgentToConfigMock,
}));

vi.mock('@/lib/admin-db', () => ({
  createAgent: vi.fn(({ id, name, userId, model, apiKey, workspaceDir }: {
    id: string;
    name: string;
    userId?: string;
    model?: string;
    apiKey?: string;
    workspaceDir: string;
  }) => {
    testDb.prepare(`
      INSERT INTO agents (id, name, user_id, model, api_key, workspace_dir, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `).run(id, name, userId || null, model || 'google/gemini-2.0-flash', apiKey || null, workspaceDir);
    return { id, name, user_id: userId || null, model: model || 'google/gemini-2.0-flash', api_key: apiKey || null, workspace_dir: workspaceDir, status: 'active' };
  }),
}));

import { GET, POST } from '../src/app/api/me/route';

function resetDb() {
  testDb = new Database(':memory:');
  testDb.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      agent_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      user_id TEXT,
      model TEXT,
      api_key TEXT,
      workspace_dir TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

describe('/api/me provisioning flow', () => {
  beforeEach(() => {
    resetDb();
    mockUserId = 'user-1';
    mockClerkUser = {
      id: 'user-1',
      fullName: 'Test User',
      firstName: 'Test',
      emailAddresses: [{ emailAddress: 'user@example.com' }],
    };
    provisionWorkspaceMock.mockClear();
    workspaceExistsMock.mockReset();
    workspaceExistsMock.mockReturnValue(false);
    addAgentToConfigMock.mockClear();
  });

  it('GET stays read-only for an unprovisioned signed-in user', async () => {
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toMatchObject({
      userId: 'user-1',
      email: 'user@example.com',
      role: 'user',
      agentId: null,
      needsProvisioning: true,
    });
    expect((testDb.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count).toBe(0);
    expect(provisionWorkspaceMock).not.toHaveBeenCalled();
  });

  it('POST provisions once and remains idempotent on repeat calls', async () => {
    const first = await POST({} as never);
    const firstData = await first.json();

    expect(first.status).toBe(200);
    expect(firstData.agentId).toBe('test-user-assistant-user-1');
    expect(firstData.role).toBe('admin');
    expect(firstData.needsProvisioning).toBe(false);
    expect((testDb.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count).toBe(1);
    expect((testDb.prepare('SELECT COUNT(*) AS count FROM agents').get() as { count: number }).count).toBe(1);
    expect(provisionWorkspaceMock).toHaveBeenCalledTimes(1);

    const second = await POST({} as never);
    const secondData = await second.json();

    expect(second.status).toBe(200);
    expect(secondData.agentId).toBe(firstData.agentId);
    expect(secondData.role).toBe('admin');
    expect((testDb.prepare('SELECT COUNT(*) AS count FROM agents').get() as { count: number }).count).toBe(1);
    expect(provisionWorkspaceMock).toHaveBeenCalledTimes(1);
  });

  it('assigns later users the regular user role when another account already exists', async () => {
    testDb.prepare('INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)').run(
      'existing-admin',
      'admin@example.com',
      'Existing Admin',
      'admin',
    );

    const res = await POST({} as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.role).toBe('user');
  });

  it('keeps an existing active personal agent without reprovisioning a replacement', async () => {
    testDb.prepare('INSERT INTO users (id, email, name, role, agent_id) VALUES (?, ?, ?, ?, ?)').run(
      'user-1',
      'user@example.com',
      'Test User',
      'user',
      'existing-agent',
    );
    testDb.prepare('INSERT INTO agents (id, name, user_id, model, api_key, workspace_dir, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      'existing-agent',
      'Existing Agent',
      'user-1',
      'google/gemini-2.0-flash',
      null,
      '../../workspaces/existing-agent',
      'active',
    );

    const res = await POST({} as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.agentId).toBe('existing-agent');
    expect((testDb.prepare('SELECT COUNT(*) AS count FROM agents').get() as { count: number }).count).toBe(1);
    expect(provisionWorkspaceMock).not.toHaveBeenCalled();
    expect(addAgentToConfigMock).not.toHaveBeenCalled();
  });

  it('reprovisions a new personal agent when the assigned agent is inactive', async () => {
    testDb.prepare('INSERT INTO users (id, email, name, role, agent_id) VALUES (?, ?, ?, ?, ?)').run(
      'user-1',
      'user@example.com',
      'Test User',
      'user',
      'inactive-agent',
    );
    testDb.prepare('INSERT INTO agents (id, name, user_id, model, api_key, workspace_dir, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      'inactive-agent',
      'Inactive Agent',
      'user-1',
      'google/gemini-2.0-flash',
      null,
      '../../workspaces/inactive-agent',
      'inactive',
    );

    const res = await POST({} as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.agentId).toBe('test-user-assistant-user-1');
    expect(provisionWorkspaceMock).toHaveBeenCalledTimes(1);
    expect((testDb.prepare('SELECT agent_id FROM users WHERE id = ?').get('user-1') as { agent_id: string }).agent_id).toBe('test-user-assistant-user-1');
  });
});
