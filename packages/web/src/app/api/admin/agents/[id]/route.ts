import { NextRequest, NextResponse } from 'next/server';
import { getAgent, updateAgent, deleteAgent, writeAuditEvent } from '@/lib/admin-db';
import { removeAgentFromConfig } from '@/lib/engine-config';
import { removeWorkspace } from '@/lib/workspace-provisioner';
import { provisionSkills } from '@/lib/skill-provisioner';
import { assertCanManageAgent, requireAdmin } from '@/lib/api-guard';
import { apiError } from '@/lib/api-error';
import { checkMutationPolicy } from '@/lib/policy';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin();
    const { id } = await params;
    assertCanManageAgent(actor, id);
    const agent = getAgent(id);
    if (!agent) return apiError('not_found', 'Not found', 404);
    return NextResponse.json(agent);
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    if (err instanceof Error && (err.message === 'FORBIDDEN' || err.message === 'FORBIDDEN_ORG_ROLE')) return apiError('insufficient_role', 'Forbidden', 403);
    if (err instanceof Error && err.message === 'FORBIDDEN_ORG_MISMATCH') {
      writeAuditEvent({ actorUserId: undefined, action: 'admin.agent.read.denied', entityType: 'agent', entityId: (await params).id, metadata: { reason: 'ORG_MISMATCH' } });
      return apiError('forbidden_org_membership', 'Forbidden', 403, { reason: 'ORG_MISMATCH' });
    }
    return apiError('internal_error', 'Failed to fetch agent', 500);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin();
    const { id } = await params;
    assertCanManageAgent(actor, id);

    const policy = checkMutationPolicy({ action: 'admin.agent.update', actor, orgId: getAgent(id)?.org_id, subjectType: 'agent', subjectId: id });
    if (!policy.allowed) {
      writeAuditEvent({ actorUserId: actor.userId, action: 'admin.agent.update.policy_blocked', entityType: 'agent', entityId: id, orgId: getAgent(id)?.org_id || undefined, metadata: policy.details });
      return apiError('policy_blocked', 'Policy blocked this action', 403, policy.details);
    }

    const body = await request.json();
    if (body.connectionIds) await provisionSkills(id, body.connectionIds);
    const updated = updateAgent(id, body);
    if (!updated) return apiError('not_found', 'Not found', 404);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    if (err instanceof Error && (err.message === 'FORBIDDEN' || err.message === 'FORBIDDEN_ORG_ROLE')) return apiError('insufficient_role', 'Forbidden', 403);
    if (err instanceof Error && err.message === 'FORBIDDEN_ORG_MISMATCH') {
      writeAuditEvent({ actorUserId: undefined, action: 'admin.agent.update.denied', entityType: 'agent', entityId: (await params).id, metadata: { reason: 'ORG_MISMATCH' } });
      return apiError('forbidden_org_membership', 'Forbidden', 403, { reason: 'ORG_MISMATCH' });
    }
    console.error('Update agent error:', err);
    return apiError('internal_error', 'Failed to update', 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin();
    const { id } = await params;
    assertCanManageAgent(actor, id);

    const agent = getAgent(id);
    if (!agent) return apiError('not_found', 'Not found', 404);

    const policy = checkMutationPolicy({ action: 'admin.agent.delete', actor, orgId: agent.org_id, subjectType: 'agent', subjectId: id });
    if (!policy.allowed) {
      writeAuditEvent({ actorUserId: actor.userId, action: 'admin.agent.delete.policy_blocked', entityType: 'agent', entityId: id, orgId: agent.org_id || undefined, metadata: policy.details });
      return apiError('policy_blocked', 'Policy blocked this action', 403, policy.details);
    }

    try {
      await removeAgentFromConfig(id);
      await removeWorkspace(id);
    } catch (err) {
      console.error('Cleanup error (continuing with delete):', err);
    }

    const deleted = deleteAgent(id);
    if (!deleted) return apiError('not_found', 'Not found', 404);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    if (err instanceof Error && (err.message === 'FORBIDDEN' || err.message === 'FORBIDDEN_ORG_ROLE')) return apiError('insufficient_role', 'Forbidden', 403);
    if (err instanceof Error && err.message === 'FORBIDDEN_ORG_MISMATCH') {
      writeAuditEvent({ actorUserId: undefined, action: 'admin.agent.delete.denied', entityType: 'agent', entityId: (await params).id, metadata: { reason: 'ORG_MISMATCH' } });
      return apiError('forbidden_org_membership', 'Forbidden', 403, { reason: 'ORG_MISMATCH' });
    }
    return apiError('internal_error', 'Failed to delete agent', 500);
  }
}
