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
});
