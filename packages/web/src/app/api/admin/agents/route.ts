import { NextRequest, NextResponse } from 'next/server';
import { listAgents, createAgent, writeAuditEvent } from '@/lib/admin-db';
import { provisionWorkspace } from '@/lib/workspace-provisioner';
import { addAgentToConfig } from '@/lib/engine-config';
import { provisionSkills } from '@/lib/skill-provisioner';
import { actorOrgIds, requireAdmin, requireOrgPermission } from '@/lib/api-guard';
import { auth } from '@clerk/nextjs/server';
import { apiError } from '@/lib/api-error';
import { checkMutationPolicy } from '@/lib/policy';

export async function GET() {
  try {
    const actor = await requireAdmin();
    const orgIds = new Set(actorOrgIds(actor));
    const agents = listAgents()
      .filter((a) => !a.org_id || actor.isSuperadmin || orgIds.has(a.org_id))
      .map(a => ({ ...a, api_key: a.api_key ? '••••' + a.api_key.slice(-4) : null }));
    return NextResponse.json(agents);
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    if (err instanceof Error && err.message === 'FORBIDDEN') return apiError('insufficient_role', 'Forbidden', 403);
    return apiError('internal_error', 'Failed to list agents', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin();
    const body = await request.json();
    const { name, userId, model, apiKey, connectionIds } = body;
    const { userId: currentUserId } = await auth();
    const assignedUserId = userId || currentUserId || undefined;

    const { getDb } = await import('@/lib/admin-db-server');
    const db = getDb();
    const assignedUser = assignedUserId
      ? db.prepare('SELECT org_id FROM users WHERE id = ? LIMIT 1').get(assignedUserId) as { org_id?: string | null } | undefined
      : undefined;
    const agentOrgId = assignedUser?.org_id || actor.orgId || null;

    if (!name) return apiError('validation_error', 'name is required', 400);
    if (!apiKey) return apiError('validation_error', 'apiKey is required', 400);
    if (!agentOrgId) return apiError('validation_error', 'actor must belong to an organization', 400, { reason: 'ORG_REQUIRED' });

    requireOrgPermission(actor, agentOrgId, 'agent.manage');
    const policy = checkMutationPolicy({ action: 'admin.agent.create', actor, orgId: agentOrgId, subjectType: 'agent' });
    if (!policy.allowed) {
      writeAuditEvent({ actorUserId: actor.userId, action: 'admin.agent.create.policy_blocked', entityType: 'agent', orgId: agentOrgId, metadata: policy.details });
      return apiError('policy_blocked', 'Policy blocked this action', 403, policy.details);
    }

    const agentId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const workspaceDir = await provisionWorkspace(agentId);

    if (connectionIds?.length) await provisionSkills(agentId, connectionIds);

    await addAgentToConfig(agentId, {
      name,
      workspace: workspaceDir,
      model: model || 'google/gemini-2.0-flash',
      apiKey: apiKey || undefined,
    });

    const agent = createAgent({ name, userId: assignedUserId, orgId: agentOrgId, model, apiKey, workspaceDir, connectionIds });

    if (assignedUserId) {
      db.prepare("UPDATE users SET agent_id = ?, org_id = COALESCE(org_id, ?), updated_at = datetime('now') WHERE id = ?")
        .run(agent.id, agentOrgId, assignedUserId);
    }

    return NextResponse.json(agent, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    if (err instanceof Error && (err.message === 'FORBIDDEN' || err.message === 'FORBIDDEN_ORG_ROLE')) return apiError('insufficient_role', 'Forbidden', 403);
    if (err instanceof Error && err.message === 'FORBIDDEN_ORG_MEMBERSHIP') {
      writeAuditEvent({ action: 'admin.agent.create.denied', entityType: 'agent', metadata: { reason: 'ORG_MEMBERSHIP_REQUIRED' } });
      return apiError('forbidden_org_membership', 'Forbidden', 403, { reason: 'ORG_MEMBERSHIP_REQUIRED' });
    }
    console.error('Create agent error:', err);
    return apiError('internal_error', `Failed to create agent: ${err instanceof Error ? err.message : String(err)}`, 500);
  }
}
