import { NextRequest, NextResponse } from 'next/server';
import { listAgents, createAgent } from '@/lib/admin-db';
import { provisionWorkspace } from '@/lib/workspace-provisioner';
import { addAgentToConfig } from '@/lib/engine-config';
import { provisionSkills } from '@/lib/skill-provisioner';

export async function GET() {
  try {
    return NextResponse.json(listAgents());
  } catch (err) {
    console.error('List agents error:', err);
    return NextResponse.json({ error: 'Failed to list agents' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, userId, model, connectionIds } = body;
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    // 1. Generate agent ID from name
    const agentId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // 2. Provision workspace (SOUL, ACTIVE, MEMORY, HEARTBEAT, etc.)
    const workspaceDir = await provisionWorkspace(agentId);

    // 3. Provision skills based on assigned connections
    if (connectionIds?.length) {
      await provisionSkills(agentId, connectionIds);
    }

    // 4. Add agent to engine config
    await addAgentToConfig(agentId, {
      name,
      workspace: workspaceDir,
      model: model || 'anthropic/claude-sonnet-4-20250514',
    });

    // 5. Store in admin DB
    const agent = createAgent({
      name,
      userId,
      model,
      workspaceDir,
      connectionIds,
    });

    return NextResponse.json(agent, { status: 201 });
  } catch (err) {
    console.error('Create agent error:', err);
    return NextResponse.json({ error: `Failed to create agent: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}
