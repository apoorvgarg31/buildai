import { NextRequest, NextResponse } from 'next/server';
import { getConnection, updateConnection, deleteConnection } from '@/lib/admin-db';
import { requireAdmin } from '@/lib/api-guard';
import { syncRuntimeFromAdminState } from '@/lib/runtime-sync';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const conn = getConnection(id);
    if (!conn) return NextResponse.json({ error: 'Not found' }, { status: 404 });
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
    await requireAdmin();
    const { id } = await params;
    const existing = getConnection(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = await request.json();
    const updated = updateConnection(id, body);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await syncRuntimeFromAdminState();
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
    await requireAdmin();
    const { id } = await params;
    const existing = getConnection(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const deleted = deleteConnection(id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await syncRuntimeFromAdminState();
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
