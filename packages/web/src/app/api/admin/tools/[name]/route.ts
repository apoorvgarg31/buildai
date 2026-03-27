import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-guard';
import { updateToolPolicy } from '@/lib/admin-db';
import { isSupportedAdminTool } from '@/lib/tool-catalog';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    await requireAdmin();
    const { name } = await params;
    if (!isSupportedAdminTool(name)) {
      return NextResponse.json({ error: `Unsupported tool: ${name}` }, { status: 400 });
    }

    const body = await request.json();
    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled boolean is required' }, { status: 400 });
    }

    const updated = updateToolPolicy(name, { enabled: body.enabled });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Update tool policy error:', err);
    return NextResponse.json({ error: 'Failed to update tool policy' }, { status: 500 });
  }
}
