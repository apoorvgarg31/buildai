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
  `);
}

vi.mock('@/lib/admin-db-server', () => ({
  getDb: () => testDb,
}));

// ── Import route handlers ──

import { GET as meGET } from '../src/app/api/me/route';

describe('Admin Flow — Auto-provisioning', () => {
  beforeEach(() => {
    resetDb();
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

    const res = await meGET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.role).toBe('admin');
    expect(data.email).toBe('apoorv@buildai.com');
    expect(data.name).toBe('Apoorv Garg');
    expect(data.agentId).toBeNull();
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
    await meGET();

    // Second: new user
    mockUserId = 'user_pm_002';
    mockClerkUser = {
      id: 'user_pm_002',
      fullName: 'Sarah Chen',
      firstName: 'Sarah',
      emailAddresses: [{ emailAddress: 'sarah@company.com' }],
      publicMetadata: {},
    };

    const res = await meGET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.role).toBe('user');
    expect(data.email).toBe('sarah@company.com');
    expect(data.agentId).toBeNull();
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

    await meGET();
    await meGET();

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
    await meGET();

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
