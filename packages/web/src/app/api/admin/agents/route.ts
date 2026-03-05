import { NextRequest, NextResponse } from 'next/server';
import { listAgents, createAgent } from '@/lib/admin-db';
import { provisionWorkspace } from '@/lib/workspace-provisioner';
import { addAgentToConfig } from '@/lib/engine-config';
import { provisionSkills } from '@/lib/skill-provisioner';
import { requireAdmin } from '@/lib/api-guard';
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  try {
    await requireAdmin();
    // Mask API keys — never return raw keys to frontend
    const agents = listAgents().map(a => ({
      ...a,
      api_key: a.api_key ? '••••' + a.api_key.slice(-4) : null,
    }));
    return NextResponse.json(agents);
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('List agents error:', err);
    return NextResponse.json({ error: 'Failed to list agents' }, { status: 500 });
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

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!apiKey) {
      return NextResponse.json({ error: 'apiKey is required' }, { status: 400 });
    }

    const agentId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const workspaceDir = await provisionWorkspace(agentId);

    if (connectionIds?.length) {
      await provisionSkills(agentId, connectionIds);
    }

    await addAgentToConfig(agentId, {
      name,
      workspace: workspaceDir,
      model: model || 'google/gemini-2.0-flash',
      apiKey: apiKey || undefined,
    });

    const agent = createAgent({
      name,
      userId: assignedUserId,
      orgId: agentOrgId,
      model,
      apiKey,
      workspaceDir,
      connectionIds,
    });

    // Auto-assign creator (or provided userId) to this agent for immediate chat usability.
    if (assignedUserId) {
      db.prepare("UPDATE users SET agent_id = ?, org_id = COALESCE(org_id, ?), updated_at = datetime('now') WHERE id = ?")
        .run(agent.id, agentOrgId, assignedUserId);
    }

    return NextResponse.json(agent, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Create agent error:', err);
    return NextResponse.json({ error: `Failed to create agent: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}
