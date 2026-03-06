import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  assertCanManageAgent: vi.fn(),
  getAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
  writeAuditEvent: vi.fn(),
  removeAgentFromConfig: vi.fn(),
  removeWorkspace: vi.fn(),
  provisionSkills: vi.fn(),
}));

vi.mock('@/lib/api-guard', () => ({
  requireAdmin: mocks.requireAdmin,
  assertCanManageAgent: mocks.assertCanManageAgent,
}));

vi.mock('@/lib/admin-db', () => ({
  getAgent: mocks.getAgent,
  updateAgent: mocks.updateAgent,
  deleteAgent: mocks.deleteAgent,
  writeAuditEvent: mocks.writeAuditEvent,
}));

vi.mock('@/lib/engine-config', () => ({
  removeAgentFromConfig: mocks.removeAgentFromConfig,
}));

vi.mock('@/lib/workspace-provisioner', () => ({
  removeWorkspace: mocks.removeWorkspace,
}));

vi.mock('@/lib/skill-provisioner', () => ({
  provisionSkills: mocks.provisionSkills,
}));

import { GET } from '../src/app/api/admin/agents/[id]/route';

describe('OA-3.5 admin agent route org isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      userId: 'admin-1',
      role: 'admin',
      orgId: 'org-a',
      agentId: null,
      email: 'admin@example.com',
      isSuperadmin: false,
    });
    mocks.assertCanManageAgent.mockImplementation(() => undefined);
  });

  it('AC-OA35-XORG-01 denies cross-org admin access to agent-by-id route', async () => {
    mocks.assertCanManageAgent.mockImplementationOnce(() => {
      throw new Error('FORBIDDEN_ORG_MISMATCH');
    });

    const res = await GET({} as NextRequest, { params: Promise.resolve({ id: 'agent-b' }) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.code).toBe('forbidden_org_membership');
    expect(data.details?.reason).toBe('ORG_MISMATCH');
  });
});
