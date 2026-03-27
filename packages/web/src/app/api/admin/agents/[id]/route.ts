import { NextRequest, NextResponse } from 'next/server';
import { getAgent, updateAgent, deleteAgent, writeAuditEvent } from '@/lib/admin-db';
import { addAgentToConfig, removeAgentFromConfig } from '@/lib/engine-config';
import { removeWorkspace } from '@/lib/workspace-provisioner';
import { provisionSkills } from '@/lib/skill-provisioner';
import { syncRuntimeFromAdminState } from '@/lib/runtime-sync';
import { assertCanManageAgent, requireAdmin } from '@/lib/api-guard';
import { apiError } from '@/lib/api-error';
import { checkMutationPolicy } from '@/lib/policy';

type UserLookup = { id?: string } | undefined;

function maskSecret(secret: string | null | undefined): string | null {
  const value = typeof secret === 'string' ? secret.trim() : '';
  if (!value) return null;
  return `••••${value.slice(-4)}`;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin();
    const { id } = await params;
    assertCanManageAgent(actor, id);
    const agent = getAgent(id);
    if (!agent) return apiError('not_found', 'Not found', 404);
    return NextResponse.json({ ...agent, api_key: maskSecret(agent.api_key) });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    if (err instanceof Error && err.message === 'FORBIDDEN') return apiError('insufficient_role', 'Forbidden', 403);
    return apiError('internal_error', 'Failed to fetch agent', 500);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin();
    const { id } = await params;
    assertCanManageAgent(actor, id);
    const existing = getAgent(id);
    if (!existing) return apiError('not_found', 'Not found', 404);

    const policy = checkMutationPolicy({ action: 'admin.agent.update', actor, subjectType: 'agent', subjectId: id });
    if (!policy.allowed) {
      writeAuditEvent({ actorUserId: actor.userId, action: 'admin.agent.update.policy_blocked', entityType: 'agent', entityId: id, metadata: policy.details });
      return apiError('policy_blocked', 'Policy blocked this action', 403, policy.details);
    }

    const body = await request.json();
    const { getDb } = await import('@/lib/admin-db-server');
    const db = getDb();
    const nextUserId = body?.userId;

    if (nextUserId !== undefined && nextUserId !== null && typeof nextUserId !== 'string') {
      return apiError('validation_error', 'userId must be a string or null', 400);
    }
    if (typeof nextUserId === 'string') {
      const assignedUser = db.prepare('SELECT id FROM users WHERE id = ? LIMIT 1').get(nextUserId) as UserLookup;
      if (!assignedUser?.id) return apiError('not_found', 'Assigned user not found', 404);
      if (existing.user_id && existing.user_id !== nextUserId) {
        return apiError('conflict', 'Agent already belongs to another user', 409, {
          reason: 'AGENT_OWNERSHIP_CONFLICT',
        });
      }
    }

    const patch = body?.apiKey === undefined
      ? body
      : { ...body, apiKey: maskSecret(body.apiKey) };
    await addAgentToConfig(id, {
      name: typeof body?.name === 'string' ? body.name : existing.name,
      workspace: existing.workspace_dir,
      model: typeof body?.model === 'string' ? body.model : existing.model,
      apiKey: typeof body?.apiKey === 'string' ? body.apiKey : undefined,
    });
    if (body.connectionIds) await provisionSkills(id, body.connectionIds);
    const updated = updateAgent(id, patch);
    if (!updated) return apiError('not_found', 'Not found', 404);

    if (nextUserId !== undefined) {
      if (typeof nextUserId === 'string') {
        db.prepare("UPDATE agents SET user_id = NULL, updated_at = datetime('now') WHERE user_id = ? AND id != ?")
          .run(nextUserId, id);
        db.prepare("UPDATE users SET agent_id = NULL, updated_at = datetime('now') WHERE agent_id = ? AND id != ?")
          .run(id, nextUserId);
        db.prepare("UPDATE users SET agent_id = ?, updated_at = datetime('now') WHERE id = ?")
          .run(id, nextUserId);
      } else {
        db.prepare("UPDATE users SET agent_id = NULL, updated_at = datetime('now') WHERE agent_id = ?")
          .run(id);
      }
    }

    await syncRuntimeFromAdminState();

    return NextResponse.json({ ...updated, api_key: maskSecret(updated.api_key) });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    if (err instanceof Error && err.message === 'FORBIDDEN') return apiError('insufficient_role', 'Forbidden', 403);
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

    const policy = checkMutationPolicy({ action: 'admin.agent.delete', actor, subjectType: 'agent', subjectId: id });
    if (!policy.allowed) {
      writeAuditEvent({ actorUserId: actor.userId, action: 'admin.agent.delete.policy_blocked', entityType: 'agent', entityId: id, metadata: policy.details });
      return apiError('policy_blocked', 'Policy blocked this action', 403, policy.details);
    }

    try {
      await removeAgentFromConfig(id);
      try {
        await removeWorkspace(id);
      } catch (err) {
        await addAgentToConfig(id, {
          name: agent.name,
          workspace: agent.workspace_dir,
          model: agent.model,
        });
        throw err;
      }
    } catch (err) {
      console.error('Delete agent cleanup failed:', err);
      return apiError('cleanup_failed', 'Failed to delete agent safely', 500);
    }

    const deleted = deleteAgent(id);
    if (!deleted) return apiError('not_found', 'Not found', 404);
    await syncRuntimeFromAdminState();
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    if (err instanceof Error && err.message === 'FORBIDDEN') return apiError('insufficient_role', 'Forbidden', 403);
    return apiError('internal_error', 'Failed to delete agent', 500);
  }
}
