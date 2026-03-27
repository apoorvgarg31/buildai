import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const requireAdminMock = vi.hoisted(() => vi.fn());
const listMcpServersMock = vi.hoisted(() => vi.fn());
const listAvailableConnectorMcpTargetsMock = vi.hoisted(() => vi.fn());
const createMcpServerMock = vi.hoisted(() => vi.fn());
const syncRuntimeFromAdminStateMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-guard', () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock('@/lib/admin-db', () => ({
  listMcpServers: listMcpServersMock,
  listAvailableConnectorMcpTargets: listAvailableConnectorMcpTargetsMock,
  createMcpServer: createMcpServerMock,
}));

vi.mock('@/lib/runtime-sync', () => ({
  syncRuntimeFromAdminState: syncRuntimeFromAdminStateMock,
}));

import { GET, POST } from '../src/app/api/admin/mcp-servers/route';

describe('/api/admin/mcp-servers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'admin@example.com' });
    syncRuntimeFromAdminStateMock.mockResolvedValue(undefined);
  });

  it('returns registered MCP servers plus available connector targets', async () => {
    listMcpServersMock.mockReturnValue([{ id: 'mcp-1', name: 'Linear MCP', server_kind: 'connector_linked' }]);
    listAvailableConnectorMcpTargetsMock.mockReturnValue([{ connection_id: 'conn-linear', connection_name: 'Linear', connection_type: 'linear' }]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.servers).toHaveLength(1);
    expect(body.availableConnectorTargets).toHaveLength(1);
  });

  it('returns 401 when the caller is not authenticated', async () => {
    requireAdminMock.mockRejectedValueOnce(new Error('UNAUTHENTICATED'));

    const res = await GET();

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Not authenticated' });
  });

  it('rejects POST requests that omit the required runtime fields', async () => {
    const req = new Request('http://localhost/api/admin/mcp-servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverKind: 'standalone' }),
    }) as unknown as NextRequest;

    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'name, serverKind, and transport are required' });
    expect(createMcpServerMock).not.toHaveBeenCalled();
  });

  it('creates a connector-linked MCP server', async () => {
    createMcpServerMock.mockReturnValue({ id: 'mcp-linear', server_kind: 'connector_linked', connection_id: 'conn-linear' });

    const req = new Request('http://localhost/api/admin/mcp-servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Linear MCP',
        serverKind: 'connector_linked',
        connectionId: 'conn-linear',
        transport: 'stdio',
        command: 'npx',
        args: ['@example/linear-mcp'],
      }),
    }) as unknown as NextRequest;

    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(createMcpServerMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Linear MCP',
      serverKind: 'connector_linked',
      connectionId: 'conn-linear',
    }));
    expect(syncRuntimeFromAdminStateMock).toHaveBeenCalledTimes(1);
  });

  it('rejects standalone MCP servers that do not provide a command or url', async () => {
    const req = new Request('http://localhost/api/admin/mcp-servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Broken standalone',
        serverKind: 'standalone',
        transport: 'stdio',
      }),
    }) as unknown as NextRequest;

    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Standalone MCP servers need a command or url' });
  });

  it('rejects connector-linked servers without a connection id', async () => {
    const req = new Request('http://localhost/api/admin/mcp-servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Broken MCP', serverKind: 'connector_linked', transport: 'stdio', command: 'npx' }),
    }) as unknown as NextRequest;

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('connectionId is required');
    expect(createMcpServerMock).not.toHaveBeenCalled();
  });

  it('returns 500 when MCP server creation fails unexpectedly', async () => {
    createMcpServerMock.mockImplementationOnce(() => {
      throw new Error('db offline');
    });

    const req = new Request('http://localhost/api/admin/mcp-servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Linear MCP',
        serverKind: 'connector_linked',
        connectionId: 'conn-linear',
        transport: 'stdio',
        command: 'npx',
      }),
    }) as unknown as NextRequest;

    const res = await POST(req);

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to create MCP server' });
  });
});
