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
});
