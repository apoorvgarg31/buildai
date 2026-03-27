import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalCwd = process.cwd();
const originalKey = process.env.BUILDAI_ENCRYPTION_KEY;

let tmpRoot: string;

async function loadAdminDb() {
  return import('../src/lib/admin-db');
}

describe('admin-db integration', () => {
  beforeEach(() => {
    vi.resetModules();
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'buildai-admin-db-'));
    fs.mkdirSync(path.join(tmpRoot, 'packages', 'web'), { recursive: true });
    process.chdir(path.join(tmpRoot, 'packages', 'web'));
    process.env.BUILDAI_ENCRYPTION_KEY = 'test-encryption-key';
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (originalKey === undefined) {
      delete process.env.BUILDAI_ENCRYPTION_KEY;
    } else {
      process.env.BUILDAI_ENCRYPTION_KEY = originalKey;
    }
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('requires an encryption key and round-trips encrypted secrets', async () => {
    const adminDb = await loadAdminDb();

    delete process.env.BUILDAI_ENCRYPTION_KEY;
    expect(() => adminDb.encrypt('secret')).toThrow('BUILDAI_ENCRYPTION_KEY env var is required');

    process.env.BUILDAI_ENCRYPTION_KEY = 'test-encryption-key';
    const encrypted = adminDb.encrypt('shared-secret');

    expect(encrypted).not.toContain('shared-secret');
    expect(adminDb.decrypt(encrypted)).toBe('shared-secret');
  });

  it('manages the user lifecycle and preserves data on no-op updates', async () => {
    const adminDb = await loadAdminDb();

    const created = adminDb.createUser({
      email: 'user@example.com',
      name: 'First User',
    });

    expect(created.role).toBe('user');
    expect(adminDb.listUsers()).toHaveLength(1);

    const unchanged = adminDb.updateUser(created.id, {});
    expect(unchanged).toMatchObject({
      id: created.id,
      email: 'user@example.com',
      name: 'First User',
    });

    const updated = adminDb.updateUser(created.id, {
      name: 'Updated User',
      role: 'admin',
      agent_id: 'agent-1',
    });
    expect(updated).toMatchObject({
      id: created.id,
      name: 'Updated User',
      role: 'admin',
      agent_id: 'agent-1',
    });

    expect(adminDb.deleteUser(created.id)).toBe(true);
    expect(adminDb.deleteUser(created.id)).toBe(false);
    expect(adminDb.getUser(created.id)).toBeUndefined();
  });

  it('separates connection secrets from visible config and preserves existing secrets during updates', async () => {
    const adminDb = await loadAdminDb();

    const connection = adminDb.createConnection({
      name: 'Procore Production',
      type: 'procore',
      authMode: 'oauth_user',
      config: {
        region: 'eu',
        clientId: 'public-client-id',
        clientSecret: 'hidden-client-secret',
      },
      secrets: {
        refreshToken: 'refresh-token',
      },
    });

    expect(JSON.parse(connection.config)).toEqual({
      region: 'eu',
      clientId: 'public-client-id',
    });
    expect(connection.has_secret).toBe(true);
    expect(adminDb.getConnectionSecrets(connection.id)).toEqual({
      clientSecret: 'hidden-client-secret',
      refreshToken: 'refresh-token',
    });

    const updated = adminDb.updateConnection(connection.id, {
      status: 'connected',
      config: {
        region: 'us',
        clientId: 'public-client-id',
        apiKey: 'new-api-key',
      },
    });

    expect(updated).toMatchObject({
      id: connection.id,
      status: 'connected',
      auth_mode: 'oauth_user',
      has_secret: true,
    });
    expect(JSON.parse(updated!.config)).toEqual({
      region: 'us',
      clientId: 'public-client-id',
    });
    expect(adminDb.getConnectionSecrets(connection.id)).toEqual({
      clientSecret: 'hidden-client-secret',
      refreshToken: 'refresh-token',
      apiKey: 'new-api-key',
    });

    expect(adminDb.deleteConnection(connection.id)).toBe(true);
    expect(adminDb.deleteConnection(connection.id)).toBe(false);
  });

  it('manages agents, assignments, installs, idempotency, and tool policy state', async () => {
    const adminDb = await loadAdminDb();

    const linear = adminDb.createConnection({
      name: 'Linear Workspace',
      type: 'linear',
      config: {},
    });
    const slack = adminDb.createConnection({
      name: 'Slack HQ',
      type: 'slack',
      config: {},
    });

    const created = adminDb.createAgent({
      name: 'Estimator Copilot',
      userId: 'user-1',
      model: 'anthropic/claude-sonnet-4-20250514',
      apiKey: 'agent-key',
      workspaceDir: '../../workspaces/agent-1',
      connectionIds: [linear.id],
    });

    expect(created.connection_ids).toEqual([linear.id]);

    const updated = adminDb.updateAgent(created.id, {
      status: 'inactive',
      apiKey: null,
      connectionIds: [slack.id],
    });
    expect(updated).toMatchObject({
      id: created.id,
      status: 'inactive',
      api_key: null,
      connection_ids: [slack.id],
    });

    adminDb.storeIdempotentResponse('idem-1', '/api/demo', 'POST', { ok: true }, 201);
    expect(adminDb.getIdempotentResponse('idem-1', '/api/demo', 'POST')).toEqual({
      responseJson: JSON.stringify({ ok: true }),
      statusCode: 201,
    });

    expect(adminDb.listUserSkillInstalls('user-1')).toEqual([]);
    adminDb.upsertUserSkillInstall({ userId: 'user-1', skillId: 'pdf', source: 'public' });
    adminDb.upsertUserSkillInstall({ userId: 'user-1', skillId: 'pdf', source: 'private' });
    expect(adminDb.listUserSkillInstalls('user-1')).toEqual([
      expect.objectContaining({ skill_id: 'pdf', source: 'private' }),
    ]);
    expect(adminDb.deleteUserSkillInstall('user-1', 'pdf')).toBe(true);
    expect(adminDb.deleteUserSkillInstall('user-1', 'pdf')).toBe(false);

    const defaultPolicies = adminDb.listToolPolicies();
    expect(defaultPolicies.find(policy => policy.name === 'browser')?.enabled).toBe(false);
    expect(adminDb.updateToolPolicy('browser', { enabled: true })).toMatchObject({
      name: 'browser',
      enabled: true,
    });
    expect(adminDb.updateToolPolicy('not-a-tool', { enabled: true })).toBeUndefined();
    expect(adminDb.listToolPolicies().find(policy => policy.name === 'browser')?.enabled).toBe(true);

    expect(adminDb.deleteAgent(created.id)).toBe(true);
    expect(adminDb.deleteAgent(created.id)).toBe(false);
  });

  it('persists admin settings and manages MCP server availability around connector-linked registrations', async () => {
    const adminDb = await loadAdminDb();

    const linear = adminDb.createConnection({
      name: 'Linear Workspace',
      type: 'linear',
      config: {},
    });
    const github = adminDb.createConnection({
      name: 'GitHub Org',
      type: 'github',
      config: {},
    });

    expect(adminDb.getAdminSettings()).toMatchObject({
      companyName: 'Mira',
      defaultModel: 'google/gemini-2.0-flash',
      hasSharedApiKey: false,
    });

    const settings = adminDb.updateAdminSettings({
      companyName: '  Enterprise Mira  ',
      defaultModel: 'openai/gpt-4.1',
      maxQueriesPerDay: 0,
      maxAgents: 25,
      dataRetentionDays: -1,
      sharedApiKey: '  shared-admin-key  ',
    });

    expect(settings).toMatchObject({
      companyName: 'Enterprise Mira',
      defaultModel: 'openai/gpt-4.1',
      maxQueriesPerDay: 500,
      maxAgents: 25,
      dataRetentionDays: 90,
      hasSharedApiKey: true,
      sharedApiKey: 'shared-admin-key',
    });

    expect(adminDb.listAvailableConnectorMcpTargets()).toEqual(expect.arrayContaining([
      expect.objectContaining({ connection_id: github.id }),
      expect.objectContaining({ connection_id: linear.id }),
    ]));

    const server = adminDb.createMcpServer({
      name: 'Linear MCP',
      serverKind: 'connector_linked',
      connectionId: linear.id,
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@acme/linear-mcp'],
      env: { LOG_LEVEL: 'debug' },
      notes: 'Linked runtime',
    });

    expect(server).toMatchObject({
      name: 'Linear MCP',
      server_kind: 'connector_linked',
      connection_id: linear.id,
      command: 'npx',
      args: ['-y', '@acme/linear-mcp'],
      env: { LOG_LEVEL: 'debug' },
      enabled: true,
    });
    expect(adminDb.listAvailableConnectorMcpTargets()).toEqual([
      expect.objectContaining({ connection_id: github.id }),
    ]);

    const updated = adminDb.updateMcpServer(server.id, {
      transport: 'http',
      url: 'https://mcp.internal/linear',
      status: 'active',
      enabled: false,
      notes: 'Promoted to shared runtime',
    });

    expect(updated).toMatchObject({
      id: server.id,
      transport: 'http',
      url: 'https://mcp.internal/linear',
      status: 'active',
      enabled: false,
      notes: 'Promoted to shared runtime',
    });
    expect(adminDb.updateMcpServer('missing-mcp', { status: 'error' })).toBeUndefined();

    expect(adminDb.deleteMcpServer(server.id)).toBe(true);
    expect(adminDb.deleteMcpServer(server.id)).toBe(false);
  });
});
