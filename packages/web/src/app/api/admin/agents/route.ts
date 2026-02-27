import { NextRequest, NextResponse } from 'next/server';
import { listAgents, createAgent } from '@/lib/admin-db';
import { provisionWorkspace } from '@/lib/workspace-provisioner';
import { addAgentToConfig } from '@/lib/engine-config';
import { provisionSkills } from '@/lib/skill-provisioner';
import { requireAdmin } from '@/lib/api-guard';

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
    await requireAdmin();
    const body = await request.json();
    const { name, userId, model, apiKey, connectionIds } = body;
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const agentId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const workspaceDir = await provisionWorkspace(agentId);

    if (connectionIds?.length) {
      await provisionSkills(agentId, connectionIds);
    }

    await addAgentToConfig(agentId, {
      name,
      workspace: workspaceDir,
      model: model || 'anthropic/claude-sonnet-4-20250514',
      apiKey: apiKey || undefined,
    });

    const agent = createAgent({
      name,
      userId,
      model,
      apiKey,
      workspaceDir,
      connectionIds,
    });

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
