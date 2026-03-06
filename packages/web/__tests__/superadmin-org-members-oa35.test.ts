import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireSuperadmin: vi.fn(),
  requireActorOrgMembership: vi.fn(),
  requireOrgPermission: vi.fn(),
  getActorRoleInOrg: vi.fn(),
  checkMutationPolicy: vi.fn(),
  getDb: vi.fn(),
  upsertOrganizationMembership: vi.fn(),
  writeAuditEvent: vi.fn(),
}));

vi.mock('@/lib/api-guard', () => ({
  requireSuperadmin: mocks.requireSuperadmin,
  requireActorOrgMembership: mocks.requireActorOrgMembership,
  requireOrgPermission: mocks.requireOrgPermission,
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

describe('OA-3.5 org members API authorization + error contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSuperadmin.mockResolvedValue({ userId: 'admin-1', role: 'admin', orgId: 'org-a' });
    mocks.requireActorOrgMembership.mockImplementation(() => undefined);
    mocks.requireOrgPermission.mockImplementation(() => undefined);
    mocks.getActorRoleInOrg.mockReturnValue('owner');
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

  it('AC-OA35-ORG-01 enforces org role checks for org members API', async () => {
    mocks.requireSuperadmin.mockRejectedValueOnce(new Error('FORBIDDEN_SUPERADMIN'));

    const res = await GET({} as NextRequest, { params: Promise.resolve({ id: 'org-a' }) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.code).toBe('insufficient_role');
  });

  it('AC-OA35-POL-01 returns policy_blocked for org-membership policy denial', async () => {
    mocks.requireActorOrgMembership.mockImplementationOnce(() => {
      throw new Error('FORBIDDEN_ORG_MEMBERSHIP');
    });

    const res = await GET({} as NextRequest, { params: Promise.resolve({ id: 'org-b' }) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.code).toBe('policy_blocked');
    expect(data.details?.reason).toBe('ORG_MEMBERSHIP_REQUIRED');
  });

  it('AC-OA35-ERR-01 uses standardized error contract on denied action', async () => {
    mocks.requireOrgPermission.mockImplementationOnce(() => {
      throw new Error('FORBIDDEN_ORG_MEMBERSHIP');
    });

    const res = await POST(
      { json: async () => ({ userId: 'user-2', role: 'member' }) } as NextRequest,
      { params: Promise.resolve({ id: 'org-b' }) }
    );
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(typeof data.code).toBe('string');
    expect(typeof data.message).toBe('string');
    expect(typeof data.requestId).toBe('string');
    expect(data.code).toBe('policy_blocked');
  });

  it('AC-OA35-AUD-01 writes denied-action audit events for blocked org membership mutations', async () => {
    mocks.requireOrgPermission.mockImplementationOnce(() => {
      throw new Error('FORBIDDEN_ORG_MEMBERSHIP');
    });

    await POST(
      { json: async () => ({ userId: 'user-2', role: 'member' }) } as NextRequest,
      { params: Promise.resolve({ id: 'org-b' }) }
    );

    expect(mocks.writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'org.membership.upsert.denied',
        entityType: 'organization_membership',
        orgId: 'org-b',
      })
    );
  });
});
