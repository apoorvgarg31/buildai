import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-guard';
import { createMcpServer, listAvailableConnectorMcpTargets, listMcpServers } from '@/lib/admin-db';

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({
      servers: listMcpServers(),
      availableConnectorTargets: listAvailableConnectorMcpTargets(),
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('List MCP servers error:', err);
    return NextResponse.json({ error: 'Failed to list MCP servers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { name, serverKind, connectionId, transport, command, args, env, url, notes } = body;

    if (!name || !serverKind || !transport) {
      return NextResponse.json({ error: 'name, serverKind, and transport are required' }, { status: 400 });
    }

    if (serverKind === 'connector_linked' && !connectionId) {
      return NextResponse.json({ error: 'connectionId is required for connector-linked MCP servers' }, { status: 400 });
    }

    if (serverKind === 'standalone' && !command && !url) {
      return NextResponse.json({ error: 'Standalone MCP servers need a command or url' }, { status: 400 });
    }

    const server = createMcpServer({
      name,
      serverKind,
      connectionId,
      transport,
      command,
      args: Array.isArray(args) ? args.map((entry) => String(entry)) : [],
      env: env && typeof env === 'object' ? env : {},
      url,
      notes,
    });
    return NextResponse.json(server, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Create MCP server error:', err);
    return NextResponse.json({ error: 'Failed to create MCP server' }, { status: 500 });
  }
}
