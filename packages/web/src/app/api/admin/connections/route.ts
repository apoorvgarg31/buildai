import { NextRequest, NextResponse } from 'next/server';
import { listConnections, createConnection } from '@/lib/admin-db';

export async function GET() {
  try {
    return NextResponse.json(listConnections());
  } catch (err) {
    console.error('List connections error:', err);
    return NextResponse.json({ error: 'Failed to list connections' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, config, secrets } = body;
    if (!name || !type) {
      return NextResponse.json({ error: 'name and type are required' }, { status: 400 });
    }
    const conn = createConnection({ name, type, config: config || {}, secrets });
    return NextResponse.json(conn, { status: 201 });
  } catch (err) {
    console.error('Create connection error:', err);
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 });
  }
}
