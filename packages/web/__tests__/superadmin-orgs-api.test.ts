import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  listOrganizations: vi.fn(),
  createOrganization: vi.fn(),
  upsertOrganizationMembership: vi.fn(),
  getIdempotentResponse: vi.fn(),
  storeIdempotentResponse: vi.fn(),
  writeAuditEvent: vi.fn(),
  requireSuperadmin: vi.fn(),
  actorOrgIds: vi.fn(),
}));

vi.mock('@/lib/admin-db', () => ({
  listOrganizations: mocks.listOrganizations,
  createOrganization: mocks.createOrganization,
  upsertOrganizationMembership: mocks.upsertOrganizationMembership,
  getIdempotentResponse: mocks.getIdempotentResponse,
  storeIdempotentResponse: mocks.storeIdempotentResponse,
  writeAuditEvent: mocks.writeAuditEvent,
}));

vi.mock('@/lib/api-guard', () => ({
  requireSuperadmin: mocks.requireSuperadmin,
  actorOrgIds: mocks.actorOrgIds,
}));

import { GET, POST } from '../src/app/api/superadmin/orgs/route';

describe('/api/superadmin/orgs (OA-1/OA-2 scaffolding)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getIdempotentResponse.mockReturnValue(null);
    mocks.actorOrgIds.mockReturnValue(['org-1']);
  });

  // AC-OA2-01: Superadmin-only org listing endpoint is available for authorized actor.
  it('AC-OA2-01 GET returns organizations for authorized superadmin', async () => {
    mocks.requireSuperadmin.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mocks.listOrganizations.mockReturnValue([{ id: 'org-1', name: 'Acme', slug: 'acme' }]);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual([{ id: 'org-1', name: 'Acme', slug: 'acme' }]);
    expect(mocks.requireSuperadmin).toHaveBeenCalledTimes(1);
  });

  // AC-OA2-02: Auth guard behavior maps unauthenticated vs forbidden correctly.
  it('AC-OA2-02 GET maps auth failures to 401/403', async () => {
    mocks.requireSuperadmin.mockRejectedValueOnce(new Error('UNAUTHENTICATED'));
    const unauth = await GET();
    expect(unauth.status).toBe(401);

    mocks.requireSuperadmin.mockRejectedValueOnce(new Error('FORBIDDEN'));
    const forbidden = await GET();
    expect(forbidden.status).toBe(403);
  });

  // AC-OA2-03: POST validates required fields and preserves predictable 400 contract.
  it('AC-OA2-03 POST requires name (backward-compatible validation)', async () => {
    mocks.requireSuperadmin.mockResolvedValue({ userId: 'admin-1', role: 'admin' });

    const req = { json: async () => ({ slug: 'missing-name' }) } as NextRequest;
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('name is required');
    expect(mocks.createOrganization).not.toHaveBeenCalled();
  });

  // AC-OA2-04: POST creates org and bootstraps owner membership.
  it('AC-OA2-04 POST creates org and bootstraps owner membership', async () => {
    mocks.requireSuperadmin.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mocks.createOrganization.mockReturnValue({ id: 'org-1', name: 'Acme', slug: 'acme', created_by_user_id: 'admin-1' });

    const req = { json: async () => ({ name: 'Acme', slug: 'acme', ownerUserId: 'user-77' }) } as NextRequest;
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mocks.createOrganization).toHaveBeenCalledWith({
      name: 'Acme',
      slug: 'acme',
      createdByUserId: 'admin-1',
    });
    expect(mocks.upsertOrganizationMembership).toHaveBeenCalledWith({
      organizationId: 'org-1',
      userId: 'user-77',
      role: 'owner',
    });
  });

  // AC-OA2-05: Owner bootstrap falls back to actor when ownerUserId omitted.
  it('AC-OA2-05 POST bootstraps actor as owner when ownerUserId is absent', async () => {
    mocks.requireSuperadmin.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mocks.createOrganization.mockReturnValue({ id: 'org-2', name: 'No Owner', slug: 'no-owner' });

    const req = { json: async () => ({ name: 'No Owner' }) } as NextRequest;
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mocks.upsertOrganizationMembership).toHaveBeenCalledWith({
      organizationId: 'org-2',
      userId: 'admin-1',
      role: 'owner',
    });
  });

  // AC-OA2-06: POST maps auth failures and conflict semantics deterministically.
  it('AC-OA2-06 POST maps auth failures and slug conflicts (409)', async () => {
    mocks.requireSuperadmin.mockRejectedValueOnce(new Error('UNAUTHENTICATED'));
    const unauth = await POST({ json: async () => ({ name: 'X' }) } as NextRequest);
    expect(unauth.status).toBe(401);

    mocks.requireSuperadmin.mockRejectedValueOnce(new Error('FORBIDDEN'));
    const forbidden = await POST({ json: async () => ({ name: 'X' }) } as NextRequest);
    expect(forbidden.status).toBe(403);

    mocks.requireSuperadmin.mockResolvedValueOnce({ userId: 'admin-1', role: 'admin' });
    mocks.createOrganization.mockImplementationOnce(() => {
      throw new Error('UNIQUE constraint failed: organizations.slug');
    });
    const internal = await POST({ json: async () => ({ name: 'X', slug: 'dup' }) } as NextRequest);
    expect(internal.status).toBe(409);
  });
});
