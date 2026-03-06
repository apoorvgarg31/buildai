import { NextRequest, NextResponse } from 'next/server';
import { actorOrgIds, requireAdmin, requireOrgPermission } from '@/lib/api-guard';
import { deleteOrgSkillAssignment, listOrgSkillAssignments, upsertOrgSkillAssignment, writeAuditEvent } from '@/lib/admin-db';
import { apiError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdmin();
    const orgId = request.nextUrl.searchParams.get('orgId') || actor.orgId;
    if (!orgId) return apiError('validation_error', 'orgId is required', 400);
    if (!actorOrgIds(actor).includes(orgId) && !actor.isSuperadmin) {
      return apiError('forbidden_org_membership', 'Forbidden', 403, { reason: 'ORG_MISMATCH' });
    }
    const items = listOrgSkillAssignments(orgId);
    return NextResponse.json({ items, orgId });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    if (err instanceof Error && err.message === 'FORBIDDEN') return apiError('insufficient_role', 'Forbidden', 403);
    return apiError('internal_error', 'Failed to list org skill assignments', 500);
  }
}

export async function POST(request: NextRequest) {
  let actor: Awaited<ReturnType<typeof requireAdmin>> | null = null;
  let body: unknown;

  try {
    actor = await requireAdmin();
    body = await request.json();
    const orgId = typeof (body as { orgId?: unknown })?.orgId === 'string' ? (body as { orgId: string }).orgId : actor.orgId;
    const skillId = typeof (body as { skillId?: unknown })?.skillId === 'string' ? (body as { skillId: string }).skillId : '';
    const required = (body as { required?: unknown })?.required !== false;

    if (!orgId) return apiError('validation_error', 'orgId is required', 400);
    if (!skillId) return apiError('validation_error', 'skillId is required', 400);

    requireOrgPermission(actor, orgId, 'agent.manage');

    const assignment = upsertOrgSkillAssignment({ orgId, skillId, required, assignedByUserId: actor.userId });
    writeAuditEvent({ actorUserId: actor.userId, action: 'org.skill.assignment.upsert', entityType: 'org_skill_assignment', entityId: `${orgId}:${skillId}`, orgId, metadata: { required } });
    return NextResponse.json(assignment, { status: 201 });
  } catch (err) {
    const parsedBody = (body && typeof body === 'object') ? body as { orgId?: unknown } : {};
    const targetOrgId = typeof parsedBody.orgId === 'string' ? parsedBody.orgId : actor?.orgId || undefined;

    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    if (err instanceof Error && err.message === 'FORBIDDEN_ORG_ROLE') {
      writeAuditEvent({ actorUserId: actor?.userId, action: 'org.skill.assignment.upsert.policy_blocked', entityType: 'org_skill_assignment', orgId: targetOrgId, metadata: { reason: err.message } });
      return apiError('policy_blocked', 'Request blocked by policy', 403, { reason: err.message });
    }
    if (err instanceof Error && (err.message === 'FORBIDDEN' || err.message === 'FORBIDDEN_ORG_MEMBERSHIP')) {
      writeAuditEvent({ actorUserId: actor?.userId, action: 'org.skill.assignment.upsert.denied', entityType: 'org_skill_assignment', orgId: targetOrgId, metadata: { reason: err.message } });
      return apiError('policy_blocked', 'Request blocked by policy', 403, { reason: err.message });
    }
    return apiError('internal_error', 'Failed to assign org skill', 500);
  }
}

export async function DELETE(request: NextRequest) {
  let actor: Awaited<ReturnType<typeof requireAdmin>> | null = null;
  let body: unknown;

  try {
    actor = await requireAdmin();
    body = await request.json();
    const orgId = typeof (body as { orgId?: unknown })?.orgId === 'string' ? (body as { orgId: string }).orgId : actor.orgId;
    const skillId = typeof (body as { skillId?: unknown })?.skillId === 'string' ? (body as { skillId: string }).skillId : '';

    if (!orgId) return apiError('validation_error', 'orgId is required', 400);
    if (!skillId) return apiError('validation_error', 'skillId is required', 400);

    requireOrgPermission(actor, orgId, 'agent.manage');
    const ok = deleteOrgSkillAssignment(orgId, skillId);
    writeAuditEvent({ actorUserId: actor.userId, action: 'org.skill.assignment.delete', entityType: 'org_skill_assignment', entityId: `${orgId}:${skillId}`, orgId });
    return NextResponse.json({ ok });
  } catch (err) {
    const parsedBody = (body && typeof body === 'object') ? body as { orgId?: unknown } : {};
    const targetOrgId = typeof parsedBody.orgId === 'string' ? parsedBody.orgId : actor?.orgId || undefined;

    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    if (err instanceof Error && err.message === 'FORBIDDEN_ORG_ROLE') {
      writeAuditEvent({ actorUserId: actor?.userId, action: 'org.skill.assignment.delete.policy_blocked', entityType: 'org_skill_assignment', orgId: targetOrgId, metadata: { reason: err.message } });
      return apiError('policy_blocked', 'Request blocked by policy', 403, { reason: err.message });
    }
    if (err instanceof Error && (err.message === 'FORBIDDEN' || err.message === 'FORBIDDEN_ORG_MEMBERSHIP')) {
      writeAuditEvent({ actorUserId: actor?.userId, action: 'org.skill.assignment.delete.denied', entityType: 'org_skill_assignment', orgId: targetOrgId, metadata: { reason: err.message } });
      return apiError('policy_blocked', 'Request blocked by policy', 403, { reason: err.message });
    }
    return apiError('internal_error', 'Failed to remove org skill assignment', 500);
  }
}
