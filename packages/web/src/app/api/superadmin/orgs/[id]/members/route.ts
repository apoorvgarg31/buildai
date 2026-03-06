import { NextRequest, NextResponse } from 'next/server';
import { getActorRoleInOrg, requireActorOrgMembership, requireOrgPermission, requireSuperadmin } from '@/lib/api-guard';
import { getDb } from '@/lib/admin-db-server';
import { upsertOrganizationMembership, writeAuditEvent } from '@/lib/admin-db';
import { apiError } from '@/lib/api-error';
import { checkMutationPolicy } from '@/lib/policy';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperadmin();
    const { id } = await params;
    requireActorOrgMembership(actor, id);
    const db = getDb();
    const rows = db.prepare(`
      SELECT m.organization_id, m.user_id, m.role, m.created_at, m.updated_at, u.email, u.name
      FROM organization_memberships m
      LEFT JOIN users u ON u.id = m.user_id
      WHERE m.organization_id = ?
      ORDER BY m.created_at DESC
    `).all(id);
    return NextResponse.json(rows);
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    if (err instanceof Error && (err.message === 'FORBIDDEN' || err.message === 'FORBIDDEN_SUPERADMIN')) return apiError('insufficient_role', 'Forbidden', 403);
    if (err instanceof Error && err.message === 'FORBIDDEN_ORG_MEMBERSHIP') return apiError('policy_blocked', 'Policy blocked this action', 403, { reason: 'ORG_MEMBERSHIP_REQUIRED' });
    return apiError('internal_error', 'Failed to list organization members', 500);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperadmin();
    const { id } = await params;
    requireOrgPermission(actor, id, 'org.members.manage');

    const policy = checkMutationPolicy({ action: 'superadmin.org.membership.upsert', actor, orgId: id, subjectType: 'organization_membership' });
    if (!policy.allowed) {
      writeAuditEvent({ actorUserId: actor.userId, action: 'org.membership.upsert.policy_blocked', entityType: 'organization_membership', orgId: id, metadata: policy.details });
      return apiError('policy_blocked', 'Policy blocked this action', 403, policy.details);
    }

    const body = await request.json();
    const userId = typeof body?.userId === 'string' ? body.userId : '';
    const role = (['owner', 'admin', 'maintainer', 'reviewer', 'member', 'auditor'] as const).includes(body?.role)
      ? body.role
      : 'member';

    if (!userId) return apiError('validation_error', 'userId is required', 400);

    const membership = upsertOrganizationMembership({ organizationId: id, userId, role });

    writeAuditEvent({ actorUserId: actor.userId, action: 'org.membership.upsert', entityType: 'organization_membership', entityId: `${id}:${userId}`, orgId: id, metadata: { role, actorRole: getActorRoleInOrg(actor, id) } });

    return NextResponse.json(membership, { status: 201 });
  } catch (err) {
    const { id } = await params;
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    if (err instanceof Error && (err.message === 'FORBIDDEN' || err.message === 'FORBIDDEN_SUPERADMIN' || err.message === 'FORBIDDEN_ORG_ROLE')) {
      writeAuditEvent({ action: 'org.membership.upsert.denied', entityType: 'organization_membership', orgId: id, metadata: { reason: err.message } });
      return apiError('insufficient_role', 'Forbidden', 403);
    }
    if (err instanceof Error && err.message === 'FORBIDDEN_ORG_MEMBERSHIP') {
      writeAuditEvent({ action: 'org.membership.upsert.denied', entityType: 'organization_membership', orgId: id, metadata: { reason: 'ORG_MEMBERSHIP_REQUIRED' } });
      return apiError('policy_blocked', 'Policy blocked this action', 403, { reason: 'ORG_MEMBERSHIP_REQUIRED' });
    }
    return apiError('internal_error', 'Failed to upsert organization member', 500);
  }
}
