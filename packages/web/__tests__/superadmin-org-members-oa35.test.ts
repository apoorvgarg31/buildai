import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireSuperadmin: vi.fn(),
  getActorRoleInOrg: vi.fn(),
  checkMutationPolicy: vi.fn(),
  getDb: vi.fn(),
  upsertOrganizationMembership: vi.fn(),
  writeAuditEvent: vi.fn(),
}));

vi.mock('@/lib/api-guard', () => ({
  requireSuperadmin: mocks.requireSuperadmin,
  getActorRoleInOrg: mocks.getActorRoleInOrg,
}));

vi.mock('@/lib/admin-db-server', () => ({
  getDb: mocks.getDb,
}));

vi.mock('@/lib/admin-db', () => ({
  upsertOrganizationMembership: mocks.upsertOrganizationMembership,
  writeAuditEvent: mocks.writeAuditEvent,
}));

vi.mock('@/lib/policy', () => ({
  checkMutationPolicy: mocks.checkMutationPolicy,
}));

import { GET, POST } from '../src/app/api/superadmin/orgs/[id]/members/route';

describe('superadmin org members API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSuperadmin.mockResolvedValue({ userId: 'admin-1', role: 'admin', orgId: 'org-a' });
    mocks.getActorRoleInOrg.mockReturnValue('admin');
    mocks.checkMutationPolicy.mockReturnValue({ allowed: true });
    mocks.getDb.mockReturnValue({
      prepare: () => ({ all: () => [] }),
    });
    mocks.upsertOrganizationMembership.mockReturnValue({
      organization_id: 'org-a',
      user_id: 'user-2',
      role: 'member',
    });
  });

  it('GET returns members for superadmin', async () => {
    const res = await GET({} as NextRequest, { params: Promise.resolve({ id: 'org-a' }) });
    expect(res.status).toBe(200);
  });

  it('GET enforces superadmin auth', async () => {
    mocks.requireSuperadmin.mockRejectedValueOnce(new Error('FORBIDDEN_SUPERADMIN'));
    const res = await GET({} as NextRequest, { params: Promise.resolve({ id: 'org-a' }) });
    expect(res.status).toBe(403);
  });

  it('POST blocks on policy and returns policy_blocked', async () => {
    mocks.checkMutationPolicy.mockReturnValueOnce({ allowed: false, details: { reason: 'TEST_BLOCK' } });

    const res = await POST(
      { json: async () => ({ userId: 'user-2', role: 'member' }) } as NextRequest,
      { params: Promise.resolve({ id: 'org-b' }) }
    );
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.code).toBe('policy_blocked');
  });

  it('POST upserts membership with simplified admin/member roles', async () => {
    const res = await POST(
      { json: async () => ({ userId: 'user-2', role: 'admin' }) } as NextRequest,
      { params: Promise.resolve({ id: 'org-b' }) }
    );

    expect(res.status).toBe(201);
    expect(mocks.upsertOrganizationMembership).toHaveBeenCalledWith({
      organizationId: 'org-b',
      userId: 'user-2',
      role: 'admin',
    });
  });
});
