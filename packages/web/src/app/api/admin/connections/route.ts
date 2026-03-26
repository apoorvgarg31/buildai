import { NextRequest, NextResponse } from 'next/server';
import { listConnections, createConnection } from '@/lib/admin-db';
import { requireAdmin } from '@/lib/api-guard';
import { getDefaultConnectorAuthMode, isSupportedConnectorType } from '@/lib/connector-catalog';

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(listConnections());
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
    await requireAdmin();
    const body = await request.json();
    const { name, type, authMode, config, secrets } = body;
    if (!name || !type) {
      return NextResponse.json({ error: 'name and type are required' }, { status: 400 });
    }
    if (!isSupportedConnectorType(type)) {
      return NextResponse.json({ error: `Unsupported connector type: ${type}` }, { status: 400 });
    }
    const conn = createConnection({ name, type, authMode: authMode || getDefaultConnectorAuthMode(type), config: config || {}, secrets });
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
