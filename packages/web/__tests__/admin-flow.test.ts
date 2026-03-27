/**
 * Test: Admin auto-provisioning, agent creation with API key, and chat guard flow.
 *
 * Flow:
 * 1. First user sign-in → auto-created as admin
 * 2. Second user sign-in → auto-created as regular user
 * 3. Admin creates agent with API key
 * 4. Admin assigns agent to user
 * 5. User without agent sees guard message (no agentId returned)
 * 6. User with agent gets agentId from /api/me
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock Clerk ──

let mockUserId: string | null = 'user_admin_001';
let mockClerkUser: Record<string, unknown> | null = {
  id: 'user_admin_001',
  fullName: 'Apoorv Garg',
  firstName: 'Apoorv',
  emailAddresses: [{ emailAddress: 'apoorv@buildai.com' }],
  publicMetadata: {},
};

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: mockUserId })),
  currentUser: vi.fn(async () => mockClerkUser),
}));

// ── Mock admin-db-server with real SQLite (in-memory) ──

import Database from 'better-sqlite3';

let testDb: InstanceType<typeof Database>;
const provisionWorkspaceMock = vi.hoisted(() => vi.fn(async (agentId: string) => `../../workspaces/${agentId}`));
const workspaceExistsMock = vi.hoisted(() => vi.fn(() => false));
const addAgentToConfigMock = vi.hoisted(() => vi.fn(async () => undefined));
const syncRuntimeFromAdminStateMock = vi.hoisted(() => vi.fn(async () => undefined));
const getAdminSettingsMock = vi.hoisted(() => vi.fn(() => ({
  companyName: 'Mira',
  defaultModel: 'google/gemini-2.0-flash',
  responseStyle: 'professional',
  maxQueriesPerDay: 500,
  maxAgents: 10,
  dataRetentionDays: 90,
  hasSharedApiKey: false,
  sharedApiKey: null,
})));

function resetDb() {
  testDb = new Database(':memory:');
  testDb.pragma('journal_mode = WAL');
  testDb.pragma('foreign_keys = ON');
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      agent_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      user_id TEXT,
      model TEXT DEFAULT 'anthropic/claude-sonnet-4-20250514',
      api_key TEXT,
      workspace_dir TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS connection_secrets (
      connection_id TEXT PRIMARY KEY REFERENCES connections(id) ON DELETE CASCADE,
      encrypted_data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agent_connections (
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
      PRIMARY KEY (agent_id, connection_id)
    );
    CREATE TABLE IF NOT EXISTS user_tokens (
      user_id TEXT NOT NULL,
      connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_type TEXT DEFAULT 'Bearer',
      expires_at INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, connection_id)
    );
  `);
}

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

vi.mock('@/lib/runtime-sync', () => ({
  syncRuntimeFromAdminState: syncRuntimeFromAdminStateMock,
}));

vi.mock('@/lib/admin-settings', () => ({
  getAdminSettings: getAdminSettingsMock,
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
    testDb.prepare(
      'INSERT INTO agents (id, name, user_id, model, api_key, workspace_dir, status) VALUES (?, ?, ?, ?, ?, ?, ?)' 
    ).run(id, name, userId || null, model || 'google/gemini-2.0-flash', apiKey || null, workspaceDir, 'active');
    return {
      id,
      name,
      user_id: userId || null,
      model: model || 'google/gemini-2.0-flash',
      api_key: apiKey || null,
      workspace_dir: workspaceDir,
      status: 'active',
    };
  }),
}));

// ── Import route handlers ──

import { GET as meGET, POST as mePOST } from '../src/app/api/me/route';

describe('Admin Flow — Auto-provisioning', () => {
  beforeEach(() => {
    resetDb();
    provisionWorkspaceMock.mockClear();
    workspaceExistsMock.mockReset();
    workspaceExistsMock.mockReturnValue(false);
    addAgentToConfigMock.mockClear();
    syncRuntimeFromAdminStateMock.mockClear();
    getAdminSettingsMock.mockClear();
    getAdminSettingsMock.mockReturnValue({
      companyName: 'Mira',
      defaultModel: 'google/gemini-2.0-flash',
      responseStyle: 'professional',
      maxQueriesPerDay: 500,
      maxAgents: 10,
      dataRetentionDays: 90,
      hasSharedApiKey: false,
      sharedApiKey: null,
    });
  });

  it('first user is auto-created as admin', async () => {
    mockUserId = 'user_admin_001';
    mockClerkUser = {
      id: 'user_admin_001',
      fullName: 'Apoorv Garg',
      firstName: 'Apoorv',
      emailAddresses: [{ emailAddress: 'apoorv@buildai.com' }],
      publicMetadata: {},
    };

    const res = await mePOST({} as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.role).toBe('admin');
    expect(data.email).toBe('apoorv@buildai.com');
    expect(data.name).toBe('Apoorv Garg');
    expect(data.agentId).toBe('apoorv-garg-assistant-in-001');
  });

  it('second user is auto-created as regular user', async () => {
    // First: create admin
    mockUserId = 'user_admin_001';
    mockClerkUser = {
      id: 'user_admin_001',
      fullName: 'Apoorv Garg',
      firstName: 'Apoorv',
      emailAddresses: [{ emailAddress: 'apoorv@buildai.com' }],
      publicMetadata: {},
    };
    await mePOST({} as never);

    // Second: new user
    mockUserId = 'user_pm_002';
    mockClerkUser = {
      id: 'user_pm_002',
      fullName: 'Sarah Chen',
      firstName: 'Sarah',
      emailAddresses: [{ emailAddress: 'sarah@company.com' }],
      publicMetadata: {},
    };

    const res = await mePOST({} as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.role).toBe('user');
    expect(data.email).toBe('sarah@company.com');
    expect(data.agentId).toBe('sarah-chen-assistant-pm-002');
  });

  it('existing user is not re-created on subsequent calls', async () => {
    mockUserId = 'user_admin_001';
    mockClerkUser = {
      id: 'user_admin_001',
      fullName: 'Apoorv Garg',
      firstName: 'Apoorv',
      emailAddresses: [{ emailAddress: 'apoorv@buildai.com' }],
      publicMetadata: {},
    };

    await mePOST({} as never);
    await mePOST({} as never);

    const count = (testDb.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt;
    expect(count).toBe(1);
  });

  it('unauthenticated request returns 401', async () => {
    mockUserId = null;

    const res = await meGET();
    expect(res.status).toBe(401);
  });
});

describe('Admin Flow — Agent Assignment', () => {
  beforeEach(() => {
    resetDb();
    syncRuntimeFromAdminStateMock.mockClear();
    getAdminSettingsMock.mockClear();
    getAdminSettingsMock.mockReturnValue({
      companyName: 'Mira',
      defaultModel: 'google/gemini-2.0-flash',
      responseStyle: 'professional',
      maxQueriesPerDay: 500,
      maxAgents: 10,
      dataRetentionDays: 90,
      hasSharedApiKey: false,
      sharedApiKey: null,
    });
  });

  it('user with assigned agent gets agentId from /api/me', async () => {
    // Create admin user
    mockUserId = 'user_admin_001';
    mockClerkUser = {
      id: 'user_admin_001',
      fullName: 'Apoorv Garg',
      firstName: 'Apoorv',
      emailAddresses: [{ emailAddress: 'apoorv@buildai.com' }],
      publicMetadata: {},
    };
    await mePOST({} as never);

    // Simulate: admin creates agent + assigns to user
    testDb.prepare(
      'INSERT INTO agents (id, name, model, workspace_dir) VALUES (?, ?, ?, ?)'
    ).run('pm-agent', 'PM Agent', 'anthropic/claude-sonnet-4-20250514', '/tmp/workspace');

    testDb.prepare('UPDATE users SET agent_id = ? WHERE id = ?').run('pm-agent', 'user_admin_001');

    // Now /api/me should return the agentId
    const res = await meGET();
    const data = await res.json();

    expect(data.agentId).toBe('pm-agent');
    expect(data.role).toBe('admin');
  });

  it('user without assigned agent gets agentId: null', async () => {
    mockUserId = 'user_admin_001';
    mockClerkUser = {
      id: 'user_admin_001',
      fullName: 'Apoorv Garg',
      firstName: 'Apoorv',
      emailAddresses: [{ emailAddress: 'apoorv@buildai.com' }],
      publicMetadata: {},
    };

    const res = await meGET();
    const data = await res.json();

    expect(data.agentId).toBeNull();
  });
});

describe('Admin Flow — Procore Connection', () => {
  beforeEach(() => {
    resetDb();
  });

  it('procore connection stores clientId in config', () => {
    testDb.prepare(
      "INSERT INTO connections (id, name, type, config) VALUES (?, ?, ?, ?)"
    ).run('conn-procore-1', 'Procore Production', 'procore', JSON.stringify({
      clientId: 'abc123',
      oauthBaseUrl: 'https://login.procore.com',
    }));

    const conn = testDb.prepare('SELECT * FROM connections WHERE id = ?').get('conn-procore-1') as Record<string, string>;
    const config = JSON.parse(conn.config);
    expect(config.clientId).toBe('abc123');
    expect(config.oauthBaseUrl).toBe('https://login.procore.com');
    expect(conn.type).toBe('procore');
  });

  it('per-user tokens are stored and retrieved correctly', () => {
    // Create connection
    testDb.prepare(
      "INSERT INTO connections (id, name, type, config) VALUES (?, ?, ?, ?)"
    ).run('conn-procore-1', 'Procore', 'procore', '{}');

    // Store user token
    testDb.prepare(`
      INSERT INTO user_tokens (user_id, connection_id, access_token, refresh_token, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('user_001', 'conn-procore-1', 'tok_abc', 'ref_xyz', 9999999999);

    const token = testDb.prepare(
      'SELECT * FROM user_tokens WHERE user_id = ? AND connection_id = ?'
    ).get('user_001', 'conn-procore-1') as Record<string, unknown>;

    expect(token.access_token).toBe('tok_abc');
    expect(token.refresh_token).toBe('ref_xyz');
    expect(token.expires_at).toBe(9999999999);
  });

  it('different users have separate tokens for same connection', () => {
    testDb.prepare(
      "INSERT INTO connections (id, name, type, config) VALUES (?, ?, ?, ?)"
    ).run('conn-procore-1', 'Procore', 'procore', '{}');

    testDb.prepare(`
      INSERT INTO user_tokens (user_id, connection_id, access_token, refresh_token, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('user_001', 'conn-procore-1', 'tok_user1', 'ref_user1', 9999999999);

    testDb.prepare(`
      INSERT INTO user_tokens (user_id, connection_id, access_token, refresh_token, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('user_002', 'conn-procore-1', 'tok_user2', 'ref_user2', 9999999999);

    const t1 = testDb.prepare('SELECT access_token FROM user_tokens WHERE user_id = ?').get('user_001') as Record<string, string>;
    const t2 = testDb.prepare('SELECT access_token FROM user_tokens WHERE user_id = ?').get('user_002') as Record<string, string>;

    expect(t1.access_token).toBe('tok_user1');
    expect(t2.access_token).toBe('tok_user2');
  });

  it('token upsert replaces existing token', () => {
    testDb.prepare(
      "INSERT INTO connections (id, name, type, config) VALUES (?, ?, ?, ?)"
    ).run('conn-procore-1', 'Procore', 'procore', '{}');

    // Insert initial
    testDb.prepare(`
      INSERT INTO user_tokens (user_id, connection_id, access_token, refresh_token, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('user_001', 'conn-procore-1', 'old_token', 'old_ref', 1000);

    // Upsert new
    testDb.prepare(`
      INSERT OR REPLACE INTO user_tokens (user_id, connection_id, access_token, refresh_token, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('user_001', 'conn-procore-1', 'new_token', 'new_ref', 2000);

    const token = testDb.prepare('SELECT * FROM user_tokens WHERE user_id = ? AND connection_id = ?').get('user_001', 'conn-procore-1') as Record<string, unknown>;
    expect(token.access_token).toBe('new_token');
    expect(token.expires_at).toBe(2000);

    const count = (testDb.prepare('SELECT COUNT(*) as cnt FROM user_tokens').get() as { cnt: number }).cnt;
    expect(count).toBe(1);
  });

  it('deleting connection cascades to user_tokens', () => {
    testDb.prepare(
      "INSERT INTO connections (id, name, type, config) VALUES (?, ?, ?, ?)"
    ).run('conn-procore-1', 'Procore', 'procore', '{}');

    testDb.prepare(`
      INSERT INTO user_tokens (user_id, connection_id, access_token, refresh_token, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('user_001', 'conn-procore-1', 'tok', 'ref', 9999999999);

    testDb.prepare('DELETE FROM connections WHERE id = ?').run('conn-procore-1');

    const count = (testDb.prepare('SELECT COUNT(*) as cnt FROM user_tokens').get() as { cnt: number }).cnt;
    expect(count).toBe(0);
  });
});

describe('Admin Flow — Agent API Key', () => {
  beforeEach(() => {
    resetDb();
  });

  it('agent can be created with api_key', () => {
    testDb.prepare(
      'INSERT INTO agents (id, name, model, api_key, workspace_dir) VALUES (?, ?, ?, ?, ?)'
    ).run('test-agent', 'Test Agent', 'anthropic/claude-sonnet-4-20250514', 'sk-ant-test123', '/tmp/ws');

    const agent = testDb.prepare('SELECT * FROM agents WHERE id = ?').get('test-agent') as Record<string, unknown>;
    expect(agent.api_key).toBe('sk-ant-test123');
    expect(agent.name).toBe('Test Agent');
  });

  it('agent api_key defaults to null', () => {
    testDb.prepare(
      'INSERT INTO agents (id, name, model, workspace_dir) VALUES (?, ?, ?, ?)'
    ).run('no-key-agent', 'No Key', 'anthropic/claude-sonnet-4-20250514', '/tmp/ws');

    const agent = testDb.prepare('SELECT * FROM agents WHERE id = ?').get('no-key-agent') as Record<string, unknown>;
    expect(agent.api_key).toBeNull();
  });
});
