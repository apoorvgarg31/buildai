import { NextRequest, NextResponse } from 'next/server';
import { getConnection, updateConnection, deleteConnection } from '@/lib/admin-db';
import { actorOrgIds, requireAdmin } from '@/lib/api-guard';

function canAccessConnection(actor: Awaited<ReturnType<typeof requireAdmin>>, orgId: string | null): boolean {
  if (actor.isSuperadmin) return true;
  if (!orgId) return false;
  return actorOrgIds(actor).includes(orgId);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin();
    const { id } = await params;
    const conn = getConnection(id);
    if (!conn) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canAccessConnection(actor, conn.org_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json(conn);
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch connection' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin();
    const { id } = await params;
    const existing = getConnection(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canAccessConnection(actor, existing.org_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await request.json();
    if (!actor.isSuperadmin) delete body.orgId;
    const updated = updateConnection(id, body);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Update connection error:', err);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin();
    const { id } = await params;
    const existing = getConnection(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canAccessConnection(actor, existing.org_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const deleted = deleteConnection(id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to delete connection' }, { status: 500 });
  }
}
