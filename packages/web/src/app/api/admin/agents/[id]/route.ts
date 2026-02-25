import { NextRequest, NextResponse } from 'next/server';
import { getAgent, updateAgent, deleteAgent } from '@/lib/admin-db';
import { removeAgentFromConfig } from '@/lib/engine-config';
import { removeWorkspace } from '@/lib/workspace-provisioner';
import { provisionSkills } from '@/lib/skill-provisioner';
import { requireAdmin } from '@/lib/api-guard';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const agent = getAgent(id);
    if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(agent);
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch agent' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    if (body.connectionIds) {
      await provisionSkills(id, body.connectionIds);
    }
    const updated = updateAgent(id, body);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Update agent error:', err);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const agent = getAgent(id);
    if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    try {
      await removeAgentFromConfig(id);
      await removeWorkspace(id);
    } catch (err) {
      console.error('Cleanup error (continuing with delete):', err);
    }

    const deleted = deleteAgent(id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 });
  }
}
