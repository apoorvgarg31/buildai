import { beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';

let mockUserId: string | null = 'user-1';
let testDb: InstanceType<typeof Database>;

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: mockUserId })),
}));

vi.mock('@/lib/admin-db-server', () => ({
  getDb: () => testDb,
}));

import { GET } from '../src/app/api/agent/connections/route';

function resetDb() {
  testDb = new Database(':memory:');
  testDb.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      agent_id TEXT
    );
    CREATE TABLE connections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      auth_mode TEXT NOT NULL DEFAULT 'shared',
      config TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE TABLE agent_connections (
      agent_id TEXT NOT NULL,
      connection_id TEXT NOT NULL,
      PRIMARY KEY (agent_id, connection_id)
    );
    CREATE TABLE user_tokens (
      user_id TEXT NOT NULL,
      connection_id TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_type TEXT DEFAULT 'Bearer',
      expires_at INTEGER,
      PRIMARY KEY (user_id, connection_id)
    );
  `);
}

describe('/api/agent/connections', () => {
  beforeEach(() => {
    resetDb();
    mockUserId = 'user-1';
  });

  it('returns shared connections as ready without requiring user auth', async () => {
    testDb.prepare('INSERT INTO users (id, agent_id) VALUES (?, ?)').run('user-1', 'agent-a');
    testDb.prepare('INSERT INTO connections (id, name, type, auth_mode, config, status) VALUES (?, ?, ?, ?, ?, ?)').run(
      'conn-db',
      'Project Database',
      'database',
      'shared',
      '{}',
      'connected',
    );
    testDb.prepare('INSERT INTO agent_connections (agent_id, connection_id) VALUES (?, ?)').run('agent-a', 'conn-db');

    const res = await GET(new Request('http://localhost/api/agent/connections') as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.connections).toEqual([
      expect.objectContaining({
        id: 'conn-db',
        authMode: 'shared',
        userAuthorized: true,
        readyForUse: true,
        requiresUserAuth: false,
      }),
    ]);
  });

  it('returns oauth connections as pending until the user authenticates', async () => {
    testDb.prepare('INSERT INTO users (id, agent_id) VALUES (?, ?)').run('user-1', 'agent-a');
    testDb.prepare('INSERT INTO connections (id, name, type, auth_mode, config, status) VALUES (?, ?, ?, ?, ?, ?)').run(
      'conn-procore',
      'Procore Production',
      'procore',
      'oauth_user',
      JSON.stringify({ oauthBaseUrl: 'https://login.procore.com' }),
      'connected',
    );
    testDb.prepare('INSERT INTO agent_connections (agent_id, connection_id) VALUES (?, ?)').run('agent-a', 'conn-procore');

    const res = await GET(new Request('http://localhost/api/agent/connections') as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.connections).toEqual([
      expect.objectContaining({
        id: 'conn-procore',
        authMode: 'oauth_user',
        userAuthorized: false,
        readyForUse: false,
        requiresUserAuth: true,
        tokenExpired: false,
        reconnectRequired: false,
        blockedReason: 'user_auth_required',
        statusLabel: 'Needs sign-in',
        actionLabel: 'Connect account',
        authUrl: '/api/procore/auth?connectionId=conn-procore',
      }),
    ]);
  });

  it('flags expired oauth credentials as needing reconnect instead of fresh setup', async () => {
    testDb.prepare('INSERT INTO users (id, agent_id) VALUES (?, ?)').run('user-1', 'agent-a');
    testDb.prepare('INSERT INTO connections (id, name, type, auth_mode, config, status) VALUES (?, ?, ?, ?, ?, ?)').run(
      'conn-procore',
      'Procore Production',
      'procore',
      'oauth_user',
      JSON.stringify({ oauthBaseUrl: 'https://login.procore.com' }),
      'connected',
    );
    testDb.prepare('INSERT INTO agent_connections (agent_id, connection_id) VALUES (?, ?)').run('agent-a', 'conn-procore');
    testDb.prepare('INSERT INTO user_tokens (user_id, connection_id, access_token, expires_at) VALUES (?, ?, ?, ?)').run(
      'user-1',
      'conn-procore',
      'expired-token',
      1,
    );

    const res = await GET(new Request('http://localhost/api/agent/connections') as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.connections).toEqual([
      expect.objectContaining({
        id: 'conn-procore',
        userAuthorized: false,
        readyForUse: false,
        tokenExpired: true,
        reconnectRequired: true,
        blockedReason: 'reconnect_required',
        statusLabel: 'Reconnect required',
        actionLabel: 'Reconnect account',
      }),
    ]);
  });

  it('surfaces token-user connectors as awaiting a personal token', async () => {
    testDb.prepare('INSERT INTO users (id, agent_id) VALUES (?, ?)').run('user-1', 'agent-a');
    testDb.prepare('INSERT INTO connections (id, name, type, auth_mode, config, status) VALUES (?, ?, ?, ?, ?, ?)').run(
      'conn-linear',
      'Linear Workspace',
      'linear',
      'token_user',
      '{}',
      'connected',
    );
    testDb.prepare('INSERT INTO agent_connections (agent_id, connection_id) VALUES (?, ?)').run('agent-a', 'conn-linear');

    const res = await GET(new Request('http://localhost/api/agent/connections') as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.connections).toEqual([
      expect.objectContaining({
        id: 'conn-linear',
        authMode: 'token_user',
        readyForUse: false,
        requiresUserAuth: true,
        tokenExpired: false,
        reconnectRequired: false,
        blockedReason: 'user_auth_required',
        statusLabel: 'Personal token required',
        actionLabel: 'Add personal token',
      }),
    ]);
  });
});
