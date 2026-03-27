import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-guard';
import { deleteMcpServer, getMcpServer, updateMcpServer } from '@/lib/admin-db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    if (!getMcpServer(id)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const body = await request.json();
    const updated = updateMcpServer(id, body);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Update MCP server error:', err);
    return NextResponse.json({ error: 'Failed to update MCP server' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    if (!getMcpServer(id)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    deleteMcpServer(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Delete MCP server error:', err);
    return NextResponse.json({ error: 'Failed to delete MCP server' }, { status: 500 });
  }
}
