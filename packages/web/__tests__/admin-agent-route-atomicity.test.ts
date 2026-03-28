import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  auth: vi.fn(),
  checkMutationPolicy: vi.fn(),
  listAgents: vi.fn(),
  createAgent: vi.fn(),
  getAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
  writeAuditEvent: vi.fn(),
  provisionWorkspace: vi.fn(),
  removeWorkspace: vi.fn(),
  addAgentToConfig: vi.fn(),
  removeAgentFromConfig: vi.fn(),
  provisionSkills: vi.fn(),
  getDb: vi.fn(),
  syncRuntimeFromAdminState: vi.fn(),
  getAdminSettings: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: mocks.auth,
}));

vi.mock('@/lib/api-guard', () => ({
  requireAdmin: mocks.requireAdmin,
  assertCanManageAgent: vi.fn(() => undefined),
}));

vi.mock('@/lib/policy', () => ({
  checkMutationPolicy: mocks.checkMutationPolicy,
}));

vi.mock('@/lib/admin-db', () => ({
  listAgents: mocks.listAgents,
  createAgent: mocks.createAgent,
  getAgent: mocks.getAgent,
  updateAgent: mocks.updateAgent,
  deleteAgent: mocks.deleteAgent,
  writeAuditEvent: mocks.writeAuditEvent,
}));

vi.mock('@/lib/workspace-provisioner', () => ({
  provisionWorkspace: mocks.provisionWorkspace,
  removeWorkspace: mocks.removeWorkspace,
}));

vi.mock('@/lib/engine-config', () => ({
  addAgentToConfig: mocks.addAgentToConfig,
  removeAgentFromConfig: mocks.removeAgentFromConfig,
}));

vi.mock('@/lib/skill-provisioner', () => ({
  provisionSkills: mocks.provisionSkills,
}));

vi.mock('@/lib/admin-db-server', () => ({
  getDb: mocks.getDb,
}));

vi.mock('@/lib/runtime-sync', () => ({
  syncRuntimeFromAdminState: mocks.syncRuntimeFromAdminState,
}));

vi.mock('@/lib/admin-settings', () => ({
  getAdminSettings: mocks.getAdminSettings,
}));

import { POST as createAgentRoute } from '../src/app/api/admin/agents/route';
import { DELETE as deleteAgentRoute, GET as getAgentRoute, PUT as updateAgentRoute } from '../src/app/api/admin/agents/[id]/route';

function jsonRequest(body: unknown): NextRequest {
  return new Request('http://localhost/api/admin/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe('admin agent route atomicity and secret masking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      userId: 'admin-1',
      role: 'admin',
      agentId: null,
      email: 'admin@example.com',
    });
    mocks.auth.mockResolvedValue({ userId: 'admin-1' });
    mocks.checkMutationPolicy.mockReturnValue({ allowed: true });
    mocks.provisionWorkspace.mockResolvedValue('../../workspaces/agent-1');
    mocks.addAgentToConfig.mockResolvedValue(undefined);
    mocks.removeAgentFromConfig.mockResolvedValue(undefined);
    mocks.removeWorkspace.mockResolvedValue(undefined);
    mocks.provisionSkills.mockResolvedValue(undefined);
    mocks.deleteAgent.mockReturnValue(true);
    mocks.syncRuntimeFromAdminState.mockResolvedValue(undefined);
    mocks.getAdminSettings.mockReturnValue({
      companyName: 'Mira',
      defaultModel: 'google/gemini-2.0-flash',
      responseStyle: 'professional',
      maxQueriesPerDay: 500,
      maxAgents: 10,
      dataRetentionDays: 90,
      hasSharedApiKey: false,
      sharedApiKey: null,
    });
    mocks.getDb.mockReturnValue({
      prepare: vi.fn(() => ({
        get: vi.fn(() => ({ id: 'admin-1' })),
        run: vi.fn(() => ({ changes: 1 })),
      })),
    });
  });

  it('masks persisted and returned api keys during create', async () => {
    mocks.createAgent.mockImplementation(({ apiKey }: { apiKey?: string }) => ({
      id: 'agent-1',
      name: 'Agent One',
      user_id: 'admin-1',
      model: 'google/gemini-2.0-flash',
      api_key: apiKey ?? null,
      workspace_dir: '../../workspaces/agent-1',
      status: 'active',
      connection_ids: [],
    }));

    const res = await createAgentRoute(jsonRequest({ name: 'Agent One', apiKey: 'secret-1234' }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(mocks.createAgent).toHaveBeenCalledWith(expect.objectContaining({ apiKey: '••••1234' }));
    expect(body.api_key).toBe('••••1234');
    expect(mocks.addAgentToConfig).toHaveBeenCalledWith(
      'agent-one',
      expect.objectContaining({ apiKey: 'secret-1234' }),
    );
    expect(mocks.syncRuntimeFromAdminState).toHaveBeenCalledTimes(1);
  });

  it('does not implicitly assign a newly created admin agent to the current admin user', async () => {
    mocks.createAgent.mockImplementation(({ userId }: { userId?: string }) => ({
      id: 'agent-1',
      name: 'Agent One',
      user_id: userId ?? null,
      model: 'google/gemini-2.0-flash',
      api_key: '••••1234',
      workspace_dir: '../../workspaces/agent-1',
      status: 'active',
      connection_ids: [],
    }));

    const res = await createAgentRoute(jsonRequest({ name: 'Agent One', apiKey: 'secret-1234' }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.user_id).toBeNull();
    expect(mocks.createAgent).toHaveBeenCalledWith(expect.objectContaining({ userId: undefined }));
  });

  it('allows agent creation without a per-agent api key when the admin shared key exists', async () => {
    mocks.getAdminSettings.mockReturnValue({
      companyName: 'Mira',
      defaultModel: 'openai/gpt-4o',
      responseStyle: 'professional',
      maxQueriesPerDay: 500,
      maxAgents: 10,
      dataRetentionDays: 90,
      hasSharedApiKey: true,
      sharedApiKey: 'shared-admin-key',
    });
    mocks.createAgent.mockImplementation(({ apiKey, model }: { apiKey?: string; model?: string }) => ({
      id: 'agent-1',
      name: 'Agent One',
      user_id: 'admin-1',
      model: model ?? 'openai/gpt-4o',
      api_key: apiKey ?? null,
      workspace_dir: '../../workspaces/agent-1',
      status: 'active',
      connection_ids: [],
    }));

    const res = await createAgentRoute(jsonRequest({ name: 'Agent One' }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.model).toBe('openai/gpt-4o');
    expect(mocks.addAgentToConfig).toHaveBeenCalledWith(
      'agent-one',
      expect.objectContaining({ apiKey: 'shared-admin-key', model: 'openai/gpt-4o' }),
    );
  });

  it("clears a user's previous agent ownership when creating a replacement agent", async () => {
    const prepareMock = vi.fn((sql: string) => {
      if (sql.includes('SELECT id FROM users')) {
        return { get: vi.fn(() => ({ id: 'user-2' })) };
      }
      return { run: vi.fn(() => ({ changes: 1 })) };
    });

    mocks.getDb.mockReturnValue({ prepare: prepareMock });
    mocks.createAgent.mockImplementation(({ userId }: { userId?: string }) => ({
      id: 'agent-1',
      name: 'Agent One',
      user_id: userId ?? null,
      model: 'google/gemini-2.0-flash',
      api_key: '••••1234',
      workspace_dir: '../../workspaces/agent-1',
      status: 'active',
      connection_ids: [],
    }));

    const res = await createAgentRoute(jsonRequest({ name: 'Agent One', apiKey: 'secret-1234', userId: 'user-2' }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.user_id).toBe('user-2');
    expect(prepareMock).toHaveBeenCalledWith('SELECT id FROM users WHERE id = ? LIMIT 1');
    expect(prepareMock).toHaveBeenCalledWith("UPDATE agents SET user_id = NULL, updated_at = datetime('now') WHERE user_id = ? AND id != ?");
    expect(prepareMock).toHaveBeenCalledWith("UPDATE users SET agent_id = ?, updated_at = datetime('now') WHERE id = ?");
  });

  it('rolls back db/config/workspace when post-create provisioning fails', async () => {
    mocks.createAgent.mockReturnValue({
      id: 'agent-one',
      name: 'Agent One',
      user_id: 'admin-1',
      model: 'google/gemini-2.0-flash',
      api_key: '••••1234',
      workspace_dir: '../../workspaces/agent-one',
      status: 'active',
      connection_ids: ['conn-1'],
    });
    mocks.provisionSkills.mockRejectedValue(new Error('skill write failed'));

    const res = await createAgentRoute(jsonRequest({
      name: 'Agent One',
      apiKey: 'secret-1234',
      connectionIds: ['conn-1'],
    }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe('internal_error');
    expect(mocks.deleteAgent).toHaveBeenCalledWith('agent-one');
    expect(mocks.removeAgentFromConfig).toHaveBeenCalledWith('agent-one');
    expect(mocks.removeWorkspace).toHaveBeenCalledWith('agent-one');
  });

  it('masks api keys for get and update responses', async () => {
    mocks.getAgent.mockReturnValue({
      id: 'agent-1',
      name: 'Agent One',
      user_id: 'admin-1',
      model: 'google/gemini-2.0-flash',
      api_key: 'plaintext-secret-1234',
      workspace_dir: '../../workspaces/agent-1',
      status: 'active',
      connection_ids: [],
    });
    mocks.updateAgent.mockImplementation((_id: string, patch: { apiKey?: string }) => ({
      id: 'agent-1',
      name: 'Agent One',
      user_id: 'admin-1',
      model: 'google/gemini-2.0-flash',
      api_key: patch.apiKey ?? null,
      workspace_dir: '../../workspaces/agent-1',
      status: 'active',
      connection_ids: [],
    }));

    const getRes = await getAgentRoute({} as NextRequest, { params: Promise.resolve({ id: 'agent-1' }) });
    expect((await getRes.json()).api_key).toBe('••••1234');

    const putReq = new Request('http://localhost/api/admin/agents/agent-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'next-secret-5678' }),
    }) as unknown as NextRequest;
    const putRes = await updateAgentRoute(putReq, { params: Promise.resolve({ id: 'agent-1' }) });
    const putBody = await putRes.json();

    expect(mocks.updateAgent).toHaveBeenCalledWith('agent-1', expect.objectContaining({ apiKey: '••••5678' }));
    expect(putBody.api_key).toBe('••••5678');
    expect(mocks.syncRuntimeFromAdminState).toHaveBeenCalledTimes(1);
  });

  it('aborts delete and restores config when workspace cleanup fails', async () => {
    mocks.getAgent.mockReturnValue({
      id: 'agent-1',
      name: 'Agent One',
      user_id: 'admin-1',
      model: 'google/gemini-2.0-flash',
      api_key: '••••1234',
      workspace_dir: '../../workspaces/agent-1',
      status: 'active',
      connection_ids: [],
    });
    mocks.removeWorkspace.mockRejectedValue(new Error('rm failed'));

    const res = await deleteAgentRoute({} as NextRequest, { params: Promise.resolve({ id: 'agent-1' }) });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe('cleanup_failed');
    expect(mocks.removeAgentFromConfig).toHaveBeenCalledWith('agent-1');
    expect(mocks.addAgentToConfig).toHaveBeenCalledWith('agent-1', expect.objectContaining({
      name: 'Agent One',
      workspace: '../../workspaces/agent-1',
      model: 'google/gemini-2.0-flash',
    }));
    expect(mocks.deleteAgent).not.toHaveBeenCalled();
  });

  it('reassigns the agent and synchronizes user agent pointers on update', async () => {
    const prepareMock = vi.fn((sql: string) => {
      if (sql.includes('SELECT id FROM users')) {
        return { get: vi.fn(() => ({ id: 'user-2' })) };
      }
      return { run: vi.fn(() => ({ changes: 1 })) };
    });

    mocks.getDb.mockReturnValue({ prepare: prepareMock });
    mocks.getAgent.mockReturnValue({
      id: 'agent-1',
      name: 'Agent One',
      user_id: null,
      model: 'google/gemini-2.0-flash',
      api_key: '••••1234',
      workspace_dir: '../../workspaces/agent-1',
      status: 'active',
      connection_ids: [],
    });
    mocks.updateAgent.mockImplementation((_id: string, patch: { userId?: string }) => ({
      id: 'agent-1',
      name: 'Agent One',
      user_id: patch.userId ?? null,
      model: 'google/gemini-2.0-flash',
      api_key: '••••1234',
      workspace_dir: '../../workspaces/agent-1',
      status: 'active',
      connection_ids: [],
    }));

    const putReq = new Request('http://localhost/api/admin/agents/agent-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-2' }),
    }) as unknown as NextRequest;

    const res = await updateAgentRoute(putReq, { params: Promise.resolve({ id: 'agent-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.user_id).toBe('user-2');
    expect(mocks.syncRuntimeFromAdminState).toHaveBeenCalledTimes(1);
    expect(prepareMock).toHaveBeenCalledWith('SELECT id FROM users WHERE id = ? LIMIT 1');
    expect(prepareMock).toHaveBeenCalledWith("UPDATE agents SET user_id = NULL, updated_at = datetime('now') WHERE user_id = ? AND id != ?");
    expect(prepareMock).toHaveBeenCalledWith("UPDATE users SET agent_id = NULL, updated_at = datetime('now') WHERE agent_id = ? AND id != ?");
    expect(prepareMock).toHaveBeenCalledWith("UPDATE users SET agent_id = ?, updated_at = datetime('now') WHERE id = ?");
  });

  it('rejects transferring an owned agent to a different user', async () => {
    mocks.getDb.mockReturnValue({
      prepare: vi.fn((sql: string) => {
        if (sql.includes('SELECT id FROM users')) {
          return { get: vi.fn(() => ({ id: 'user-2' })) };
        }
        return { run: vi.fn(() => ({ changes: 1 })) };
      }),
    });
    mocks.getAgent.mockReturnValue({
      id: 'agent-1',
      name: 'Agent One',
      user_id: 'user-1',
      model: 'google/gemini-2.0-flash',
      api_key: '••••1234',
      workspace_dir: '../../workspaces/agent-1',
      status: 'active',
      connection_ids: [],
    });

    const putReq = new Request('http://localhost/api/admin/agents/agent-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-2' }),
    }) as unknown as NextRequest;

    const res = await updateAgentRoute(putReq, { params: Promise.resolve({ id: 'agent-1' }) });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe('conflict');
    expect(body.details?.reason).toBe('AGENT_OWNERSHIP_CONFLICT');
    expect(mocks.updateAgent).not.toHaveBeenCalled();
    expect(mocks.syncRuntimeFromAdminState).not.toHaveBeenCalled();
  });

  it('rejects reassignment to a missing user', async () => {
    mocks.getDb.mockReturnValue({
      prepare: vi.fn((sql: string) => {
        if (sql.includes('SELECT id FROM users')) {
          return { get: vi.fn(() => undefined) };
        }
        return { run: vi.fn(() => ({ changes: 1 })) };
      }),
    });
    mocks.getAgent.mockReturnValue({
      id: 'agent-1',
      name: 'Agent One',
      user_id: 'user-1',
      model: 'google/gemini-2.0-flash',
      api_key: '••••1234',
      workspace_dir: '../../workspaces/agent-1',
      status: 'active',
      connection_ids: [],
    });

    const putReq = new Request('http://localhost/api/admin/agents/agent-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'missing-user' }),
    }) as unknown as NextRequest;

    const res = await updateAgentRoute(putReq, { params: Promise.resolve({ id: 'agent-1' }) });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe('not_found');
    expect(mocks.updateAgent).not.toHaveBeenCalled();
  });
});
