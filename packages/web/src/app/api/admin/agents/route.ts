import { NextRequest, NextResponse } from 'next/server';
import { listAgents, createAgent, deleteAgent, writeAuditEvent } from '@/lib/admin-db';
import { provisionWorkspace, removeWorkspace } from '@/lib/workspace-provisioner';
import { addAgentToConfig, removeAgentFromConfig } from '@/lib/engine-config';
import { provisionSkills } from '@/lib/skill-provisioner';
import { syncRuntimeFromAdminState } from '@/lib/runtime-sync';
import { requireAdmin } from '@/lib/api-guard';
import { auth } from '@clerk/nextjs/server';
import { apiError } from '@/lib/api-error';
import { checkMutationPolicy } from '@/lib/policy';
import { getAdminSettings } from '@/lib/admin-settings';

function maskSecret(secret: string | null | undefined): string | null {
  const value = typeof secret === 'string' ? secret.trim() : '';
  if (!value) return null;
  return `••••${value.slice(-4)}`;
}

export async function GET() {
  try {
    await requireAdmin();
    const agents = listAgents().map((a) => ({ ...a, api_key: maskSecret(a.api_key) }));
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
    const settings = getAdminSettings();
    await auth();
    const assignedUserId = typeof userId === 'string' && userId.trim().length > 0 ? userId : undefined;
    const effectiveModel = typeof model === 'string' && model.trim().length > 0 ? model : settings.defaultModel;
    const effectiveApiKey = typeof apiKey === 'string' && apiKey.trim().length > 0 ? apiKey : (settings.sharedApiKey || undefined);
    const maskedApiKey = maskSecret(effectiveApiKey);

    const { getDb } = await import('@/lib/admin-db-server');
    const db = getDb();
    const assignedUser = assignedUserId
      ? db.prepare('SELECT id FROM users WHERE id = ? LIMIT 1').get(assignedUserId) as { id?: string } | undefined
      : undefined;

    if (!name) return apiError('validation_error', 'name is required', 400);
    if (!effectiveApiKey) return apiError('validation_error', 'apiKey is required', 400);
    if (assignedUserId && !assignedUser?.id) return apiError('not_found', 'Assigned user not found', 404);

    const policy = checkMutationPolicy({ action: 'admin.agent.create', actor, subjectType: 'agent' });
    if (!policy.allowed) {
      writeAuditEvent({ actorUserId: actor.userId, action: 'admin.agent.create.policy_blocked', entityType: 'agent', metadata: policy.details });
      return apiError('policy_blocked', 'Policy blocked this action', 403, policy.details);
    }

    const agentId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let workspaceDir: string | null = null;
    let configAdded = false;
    let agentCreated = false;

    try {
      workspaceDir = await provisionWorkspace(agentId);

      await addAgentToConfig(agentId, {
        name,
        workspace: workspaceDir,
        model: effectiveModel,
        apiKey: effectiveApiKey,
      });
      configAdded = true;

      const agent = createAgent({
        name,
        userId: assignedUserId,
        model: effectiveModel,
        apiKey: maskedApiKey || undefined,
        workspaceDir,
        connectionIds,
      });
      agentCreated = true;

      if (assignedUserId) {
        db.prepare("UPDATE agents SET user_id = NULL, updated_at = datetime('now') WHERE user_id = ? AND id != ?")
          .run(assignedUserId, agent.id);
        db.prepare("UPDATE users SET agent_id = ?, updated_at = datetime('now') WHERE id = ?")
          .run(agent.id, assignedUserId);
      }

      if (connectionIds?.length) {
        await provisionSkills(agentId, connectionIds);
      }

      await syncRuntimeFromAdminState();

      return NextResponse.json({ ...agent, api_key: maskSecret(agent.api_key) }, { status: 201 });
    } catch (err) {
      if (agentCreated) {
        try {
          const rollbackAgent = deleteAgent(agentId);
          if (!rollbackAgent) {
            console.error('Create agent rollback could not remove db row:', agentId);
          }
        } catch (rollbackErr) {
          console.error('Create agent rollback db cleanup failed:', rollbackErr);
        }
      }
      if (configAdded) {
        try {
          await removeAgentFromConfig(agentId);
        } catch (rollbackErr) {
          console.error('Create agent rollback config cleanup failed:', rollbackErr);
        }
      }
      if (workspaceDir) {
        try {
          await removeWorkspace(agentId);
        } catch (rollbackErr) {
          console.error('Create agent rollback workspace cleanup failed:', rollbackErr);
        }
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    if (err instanceof Error && err.message === 'FORBIDDEN') return apiError('insufficient_role', 'Forbidden', 403);
    console.error('Create agent error:', err);
    return apiError('internal_error', `Failed to create agent: ${err instanceof Error ? err.message : String(err)}`, 500);
  }
}
