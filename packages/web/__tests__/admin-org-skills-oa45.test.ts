import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  actorOrgIds: vi.fn(),
  requireOrgPermission: vi.fn(),
  listOrgSkillAssignments: vi.fn(),
  upsertOrgSkillAssignment: vi.fn(),
  deleteOrgSkillAssignment: vi.fn(),
  writeAuditEvent: vi.fn(),
}));

vi.mock('@/lib/api-guard', () => ({
  requireAdmin: mocks.requireAdmin,
  actorOrgIds: mocks.actorOrgIds,
  requireOrgPermission: mocks.requireOrgPermission,
}));

vi.mock('@/lib/admin-db', () => ({
  listOrgSkillAssignments: mocks.listOrgSkillAssignments,
  upsertOrgSkillAssignment: mocks.upsertOrgSkillAssignment,
  deleteOrgSkillAssignment: mocks.deleteOrgSkillAssignment,
  writeAuditEvent: mocks.writeAuditEvent,
}));

import { DELETE, GET, POST } from '../src/app/api/admin/org-skills/route';

describe('OA-4/5 admin org-skill assignment API behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      userId: 'admin-1',
      role: 'admin',
      orgId: 'org-a',
      isSuperadmin: false,
    });
    mocks.actorOrgIds.mockReturnValue(['org-a']);
    mocks.requireOrgPermission.mockImplementation(() => undefined);
    mocks.listOrgSkillAssignments.mockReturnValue([{ org_id: 'org-a', skill_id: 'skill-1', required: 1 }]);
    mocks.upsertOrgSkillAssignment.mockReturnValue({ org_id: 'org-a', skill_id: 'skill-1', required: 1 });
    mocks.deleteOrgSkillAssignment.mockReturnValue(true);
  });

  it('AC-OA4-01 GET enforces org membership isolation for org skill assignments', async () => {
    const req = { nextUrl: new URL('http://localhost/api/admin/org-skills?orgId=org-b') } as unknown as NextRequest;
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.code).toBe('forbidden_org_membership');
    expect(data.details?.reason).toBe('ORG_MISMATCH');
  });

  it('AC-OA4-02 POST validates required fields using stable error contract', async () => {
    const req = { json: async () => ({ orgId: 'org-a' }) } as NextRequest;
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.code).toBe('validation_error');
    expect(typeof data.message).toBe('string');
    expect(typeof data.requestId).toBe('string');
  });

  it('AC-OA5-01 denied org-skill mutation emits denied audit event + standard policy_blocked contract', async () => {
    mocks.requireOrgPermission.mockImplementationOnce(() => {
      throw new Error('FORBIDDEN_ORG_MEMBERSHIP');
    });

    const req = { json: async () => ({ orgId: 'org-b', skillId: 'skill-x' }) } as NextRequest;
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.code).toBe('policy_blocked');
    expect(typeof data.message).toBe('string');
    expect(typeof data.requestId).toBe('string');

    expect(mocks.writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'org.skill.assignment.upsert.denied',
        entityType: 'org_skill_assignment',
        orgId: 'org-b',
      }),
    );
  });

  it('AC-OA4-03 DELETE validates skillId for removal', async () => {
    const req = { json: async () => ({ orgId: 'org-a' }) } as NextRequest;
    const res = await DELETE(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.code).toBe('validation_error');
  });
});
