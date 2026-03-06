import { NextRequest, NextResponse } from 'next/server';
import { createOrganization, getIdempotentResponse, listOrganizations, storeIdempotentResponse, upsertOrganizationMembership, writeAuditEvent } from '@/lib/admin-db';
import { actorOrgIds, requireSuperadmin } from '@/lib/api-guard';
import { apiError } from '@/lib/api-error';
import { checkMutationPolicy } from '@/lib/policy';

export async function GET() {
  try {
    const actor = await requireSuperadmin();
    const orgIds = actorOrgIds(actor);
    if (orgIds.length === 0) return apiError('org_membership_required', 'Actor must belong to at least one organization', 403, { reason: 'ORG_MEMBERSHIP_REQUIRED' });
    const orgs = listOrganizations().filter((org) => orgIds.includes(org.id));
    return NextResponse.json(orgs);
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
    const existingOrgs = listOrganizations();
    if (existingOrgs.length > 0 && actorOrgIds(actor).length === 0) {
      writeAuditEvent({ actorUserId: actor.userId, action: 'org.create.denied', entityType: 'organization', metadata: { reason: 'ORG_MEMBERSHIP_REQUIRED' } });
      return apiError('org_membership_required', 'Actor must belong to an organization', 403, { reason: 'ORG_MEMBERSHIP_REQUIRED' });
    }

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
    upsertOrganizationMembership({ organizationId: org.id, userId: ownerUserId || actor.userId, role: 'owner' });

    writeAuditEvent({ actorUserId: actor.userId, action: 'org.create', entityType: 'organization', entityId: org.id, orgId: org.id, metadata: { slug: org.slug, ownerUserId: ownerUserId || actor.userId } });

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
