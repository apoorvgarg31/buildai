import { NextRequest, NextResponse } from 'next/server';
import { getAgent, updateAgent, deleteAgent } from '@/lib/admin-db';
import { removeAgentFromConfig } from '@/lib/engine-config';
import { removeWorkspace } from '@/lib/workspace-provisioner';
import { provisionSkills } from '@/lib/skill-provisioner';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = getAgent(id);
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(agent);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await request.json();
    // If connections changed, re-provision skills
    if (body.connectionIds) {
      await provisionSkills(id, body.connectionIds);
    }
    const updated = updateAgent(id, body);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('Update agent error:', err);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = getAgent(id);
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  
  // Remove from engine config, delete workspace, then remove from DB
  try {
    await removeAgentFromConfig(id);
    await removeWorkspace(id);
  } catch (err) {
    console.error('Cleanup error (continuing with delete):', err);
  }
  
  const deleted = deleteAgent(id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
