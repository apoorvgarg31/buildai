import { NextRequest, NextResponse } from 'next/server';
import { listConnections, createConnection } from '@/lib/admin-db';
import { actorOrgIds, requireAdmin } from '@/lib/api-guard';

export async function GET() {
  try {
    const actor = await requireAdmin();
    const connections = actor.isSuperadmin
      ? listConnections()
      : listConnections({ orgIds: actorOrgIds(actor), includeUnscoped: false });
    return NextResponse.json(connections);
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('List connections error:', err);
    return NextResponse.json({ error: 'Failed to list connections' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin();
    const body = await request.json();
    const { name, type, config, secrets } = body;
    const requestedOrgId = typeof body?.orgId === 'string' ? body.orgId : null;
    const orgId = actor.isSuperadmin ? requestedOrgId : actor.orgId;
    if (!name || !type) {
      return NextResponse.json({ error: 'name and type are required' }, { status: 400 });
    }
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
    }
    const conn = createConnection({ orgId, name, type, config: config || {}, secrets });
    return NextResponse.json(conn, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Create connection error:', err);
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 });
  }
}
