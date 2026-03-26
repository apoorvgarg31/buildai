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
let nextOrgId = 1;

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
  createOrganization: vi.fn(({ name, slug, createdByUserId }: { name: string; slug: string; createdByUserId: string }) => {
    const id = `org-${nextOrgId++}`;
    testDb.prepare('INSERT INTO organizations (id, name, slug, created_by_user_id) VALUES (?, ?, ?, ?)').run(id, name, slug, createdByUserId);
    return { id, name, slug, created_by_user_id: createdByUserId };
  }),
  upsertOrganizationMembership: vi.fn(({ organizationId, userId, role }: { organizationId: string; userId: string; role: string }) => {
    testDb.prepare(`
      INSERT INTO organization_memberships (organization_id, user_id, role)
      VALUES (?, ?, ?)
      ON CONFLICT(organization_id, user_id)
      DO UPDATE SET role = excluded.role, updated_at = datetime('now')
    `).run(organizationId, userId, role);
  }),
  createAgent: vi.fn(({ id, name, userId, orgId, model, apiKey, workspaceDir }: {
    id: string;
    name: string;
    userId?: string;
    orgId?: string | null;
    model?: string;
    apiKey?: string;
    workspaceDir: string;
  }) => {
    testDb.prepare(`
      INSERT INTO agents (id, name, user_id, org_id, model, api_key, workspace_dir, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(id, name, userId || null, orgId || null, model || 'google/gemini-2.0-flash', apiKey || null, workspaceDir);
    return { id, name, user_id: userId || null, org_id: orgId || null, model: model || 'google/gemini-2.0-flash', api_key: apiKey || null, workspace_dir: workspaceDir, status: 'active' };
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
      org_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      user_id TEXT,
      org_id TEXT,
      model TEXT,
      api_key TEXT,
      workspace_dir TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_by_user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE organization_memberships (
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (organization_id, user_id)
    );
  `);
}

describe('/api/me provisioning flow', () => {
  beforeEach(() => {
    resetDb();
    nextOrgId = 1;
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
      agentId: null,
      orgId: null,
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
    expect(firstData.orgId).toBe('org-1');
    expect(firstData.needsProvisioning).toBe(false);
    expect((testDb.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count).toBe(1);
    expect((testDb.prepare('SELECT COUNT(*) AS count FROM organizations').get() as { count: number }).count).toBe(1);
    expect((testDb.prepare('SELECT COUNT(*) AS count FROM agents').get() as { count: number }).count).toBe(1);
    expect(provisionWorkspaceMock).toHaveBeenCalledTimes(1);

    const second = await POST({} as never);
    const secondData = await second.json();

    expect(second.status).toBe(200);
    expect(secondData.agentId).toBe(firstData.agentId);
    expect(secondData.orgId).toBe(firstData.orgId);
    expect((testDb.prepare('SELECT COUNT(*) AS count FROM organizations').get() as { count: number }).count).toBe(1);
    expect((testDb.prepare('SELECT COUNT(*) AS count FROM agents').get() as { count: number }).count).toBe(1);
    expect(provisionWorkspaceMock).toHaveBeenCalledTimes(1);
  });
});
