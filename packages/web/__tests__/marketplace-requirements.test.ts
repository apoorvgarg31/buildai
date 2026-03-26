import { beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';

let testDb: InstanceType<typeof Database>;

const requireSignedInMock = vi.hoisted(() => vi.fn());
const canAccessAgentMock = vi.hoisted(() => vi.fn(() => true));

vi.mock('@/lib/api-guard', () => ({
  requireSignedIn: requireSignedInMock,
  canAccessAgent: canAccessAgentMock,
}));

vi.mock('@/lib/admin-db-server', () => ({
  getDb: () => testDb,
}));

vi.mock('@/lib/admin-db', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/admin-db')>('../src/lib/admin-db');
  return {
    ...actual,
    listUserSkillInstalls: vi.fn(() => []),
  };
});

import { GET } from '../src/app/api/marketplace/skills/route';

function resetDb() {
  testDb = new Database(':memory:');
  testDb.exec(`
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
      expires_at INTEGER,
      PRIMARY KEY (user_id, connection_id)
    );
  `);
}

describe('/api/marketplace/skills requirements', () => {
  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
    requireSignedInMock.mockResolvedValue({ userId: 'user-1', role: 'user', agentId: 'agent-a', email: 'user@example.com' });
    canAccessAgentMock.mockReturnValue(true);
  });

  it('marks skills without required connectors as ready', async () => {
    const res = await GET({ nextUrl: new URL('http://localhost/api/marketplace/skills?agentId=agent-a') } as never);
    const data = await res.json();
    const monitor = data.skills.find((skill: { id: string }) => skill.id === 'buildai-monitor');

    expect(res.status).toBe(200);
    expect(monitor.requiresConnections).toBe(false);
    expect(monitor.requirementsSatisfied).toBe(true);
  });

  it('marks shared connector skills as ready when the agent has that enterprise connection', async () => {
    testDb.prepare('INSERT INTO connections (id, name, type, auth_mode, config, status) VALUES (?, ?, ?, ?, ?, ?)').run(
      'conn-db',
      'Project Database',
      'database',
      'shared',
      '{}',
      'connected',
    );
    testDb.prepare('INSERT INTO agent_connections (agent_id, connection_id) VALUES (?, ?)').run('agent-a', 'conn-db');

    const res = await GET({ nextUrl: new URL('http://localhost/api/marketplace/skills?agentId=agent-a') } as never);
    const data = await res.json();
    const databaseSkill = data.skills.find((skill: { id: string }) => skill.id === 'buildai-database');

    expect(databaseSkill.requirementsSatisfied).toBe(true);
    expect(databaseSkill.requirementStates).toEqual([
      expect.objectContaining({ type: 'database', authMode: 'shared', ready: true }),
    ]);
  });

  it('marks oauth connector skills as blocked until the user authenticates', async () => {
    testDb.prepare('INSERT INTO connections (id, name, type, auth_mode, config, status) VALUES (?, ?, ?, ?, ?, ?)').run(
      'conn-procore',
      'Procore Production',
      'procore',
      'oauth_user',
      '{}',
      'connected',
    );
    testDb.prepare('INSERT INTO agent_connections (agent_id, connection_id) VALUES (?, ?)').run('agent-a', 'conn-procore');

    const res = await GET({ nextUrl: new URL('http://localhost/api/marketplace/skills?agentId=agent-a') } as never);
    const data = await res.json();
    const procoreSkill = data.skills.find((skill: { id: string }) => skill.id === 'buildai-procore');

    expect(procoreSkill.requirementsSatisfied).toBe(false);
    expect(procoreSkill.requirementStates).toEqual([
      expect.objectContaining({
        type: 'procore',
        authMode: 'oauth_user',
        ready: false,
        needsUserAuth: true,
        tokenExpired: false,
        reconnectRequired: false,
        blockedReason: 'user_auth_required',
        statusLabel: 'Needs sign-in',
      }),
    ]);
  });

  it('marks missing connector setup as an admin configuration gap', async () => {
    const res = await GET({ nextUrl: new URL('http://localhost/api/marketplace/skills?agentId=agent-a') } as never);
    const data = await res.json();
    const procoreSkill = data.skills.find((skill: { id: string }) => skill.id === 'buildai-procore');

    expect(procoreSkill.requirementsSatisfied).toBe(false);
    expect(procoreSkill.requirementStates).toEqual([
      expect.objectContaining({
        type: 'procore',
        available: false,
        ready: false,
        blockedReason: 'admin_setup_required',
        statusLabel: 'Admin setup needed',
      }),
    ]);
  });

  it('marks expired user auth as reconnect required', async () => {
    testDb.prepare('INSERT INTO connections (id, name, type, auth_mode, config, status) VALUES (?, ?, ?, ?, ?, ?)').run(
      'conn-procore',
      'Procore Production',
      'procore',
      'oauth_user',
      '{}',
      'connected',
    );
    testDb.prepare('INSERT INTO agent_connections (agent_id, connection_id) VALUES (?, ?)').run('agent-a', 'conn-procore');
    testDb.prepare('INSERT INTO user_tokens (user_id, connection_id, access_token, expires_at) VALUES (?, ?, ?, ?)').run(
      'user-1',
      'conn-procore',
      'expired-token',
      1,
    );

    const res = await GET({ nextUrl: new URL('http://localhost/api/marketplace/skills?agentId=agent-a') } as never);
    const data = await res.json();
    const procoreSkill = data.skills.find((skill: { id: string }) => skill.id === 'buildai-procore');

    expect(procoreSkill.requirementsSatisfied).toBe(false);
    expect(procoreSkill.requirementStates).toEqual([
      expect.objectContaining({
        type: 'procore',
        ready: false,
        tokenExpired: true,
        reconnectRequired: true,
        blockedReason: 'reconnect_required',
        statusLabel: 'Reconnect required',
      }),
    ]);
  });
});
