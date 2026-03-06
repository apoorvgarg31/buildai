import { NextRequest, NextResponse } from 'next/server';
import { createOrganization, getIdempotentResponse, listOrganizations, storeIdempotentResponse, upsertOrganizationMembership, writeAuditEvent } from '@/lib/admin-db';
import { requireSuperadmin } from '@/lib/api-guard';
import { getDb } from '@/lib/admin-db-server';
import { apiError } from '@/lib/api-error';
import { checkMutationPolicy } from '@/lib/policy';

export async function GET() {
  try {
    await requireSuperadmin();
    const orgs = listOrganizations();
    const db = getDb();

    const rows = db.prepare(`
      SELECT
        o.id,
        COALESCE(SUM(CASE WHEN m.role = 'admin' THEN 1 ELSE 0 END), 0) AS admins_count,
        COUNT(DISTINCT m.user_id) AS members_count,
        COUNT(DISTINCT a.id) AS agents_count
      FROM organizations o
      LEFT JOIN organization_memberships m ON m.organization_id = o.id
      LEFT JOIN agents a ON a.org_id = o.id
      GROUP BY o.id
    `).all() as Array<{ id: string; admins_count: number; members_count: number; agents_count: number }>;

    const byId = new Map(rows.map((r) => [r.id, r]));
    return NextResponse.json(orgs.map((org) => ({
      ...org,
      members_count: byId.get(org.id)?.members_count ?? 0,
      admins_count: byId.get(org.id)?.admins_count ?? 0,
      agents_count: byId.get(org.id)?.agents_count ?? 0,
    })));
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    if (err instanceof Error && (err.message === 'FORBIDDEN' || err.message === 'FORBIDDEN_SUPERADMIN')) return apiError('insufficient_role', 'Forbidden', 403);
    return apiError('internal_error', 'Failed to list organizations', 500);
  }
}

export async function POST(request: NextRequest) {
  const route = '/api/superadmin/orgs';
  const method = 'POST';
  try {
    const actor = await requireSuperadmin();

    const policy = checkMutationPolicy({ action: 'superadmin.org.create', actor, subjectType: 'organization' });
    if (!policy.allowed) {
      writeAuditEvent({ actorUserId: actor.userId, action: 'org.create.policy_blocked', entityType: 'organization', metadata: policy.details });
      return apiError('policy_blocked', 'Policy blocked this action', 403, policy.details);
    }

    const idempotencyKey = request.headers?.get('Idempotency-Key') || request.headers?.get('idempotency-key');
    if (idempotencyKey) {
      const existing = getIdempotentResponse(idempotencyKey, route, method);
      if (existing) return NextResponse.json(JSON.parse(existing.responseJson), { status: existing.statusCode });
    }

    const body = await request.json();
    const { name, slug, ownerUserId } = body as { name?: string; slug?: string; ownerUserId?: string };
    if (!name?.trim()) return apiError('validation_error', 'name is required', 400);

    const org = createOrganization({ name, slug, createdByUserId: actor.userId });
    upsertOrganizationMembership({ organizationId: org.id, userId: ownerUserId || actor.userId, role: 'admin' });

    writeAuditEvent({ actorUserId: actor.userId, action: 'org.create', entityType: 'organization', entityId: org.id, orgId: org.id, metadata: { slug: org.slug, ownerUserId: ownerUserId || actor.userId, bootstrapRole: 'admin' } });

    if (idempotencyKey) storeIdempotentResponse(idempotencyKey, route, method, org, 201);
    return NextResponse.json(org, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    if (err instanceof Error && (err.message === 'FORBIDDEN' || err.message === 'FORBIDDEN_SUPERADMIN')) return apiError('insufficient_role', 'Forbidden', 403);
    if (err instanceof Error && (err.message === 'INVALID_ORG_NAME' || err.message === 'INVALID_ORG_SLUG')) return apiError('validation_error', 'Invalid organization name or slug', 400);
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed: organizations.slug')) return apiError('conflict', 'Organization slug already exists', 409);
    return apiError('internal_error', 'Failed to create organization', 500);
  }
}
