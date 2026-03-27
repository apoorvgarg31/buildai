import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const requireAdminMock = vi.hoisted(() => vi.fn());
const getMcpServerMock = vi.hoisted(() => vi.fn());
const updateMcpServerMock = vi.hoisted(() => vi.fn());
const deleteMcpServerMock = vi.hoisted(() => vi.fn());
const syncRuntimeFromAdminStateMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-guard', () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock('@/lib/admin-db', () => ({
  getMcpServer: getMcpServerMock,
  updateMcpServer: updateMcpServerMock,
  deleteMcpServer: deleteMcpServerMock,
}));

vi.mock('@/lib/runtime-sync', () => ({
  syncRuntimeFromAdminState: syncRuntimeFromAdminStateMock,
}));

import { DELETE, PUT } from '../src/app/api/admin/mcp-servers/[id]/route';

describe('/api/admin/mcp-servers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'admin@example.com' });
    getMcpServerMock.mockReturnValue({ id: 'mcp-1', name: 'Linear MCP' });
    updateMcpServerMock.mockReturnValue({ id: 'mcp-1', enabled: true });
    deleteMcpServerMock.mockReturnValue(true);
    syncRuntimeFromAdminStateMock.mockResolvedValue(undefined);
  });

  it('syncs runtime after an MCP server update', async () => {
    const req = new Request('http://localhost/api/admin/mcp-servers/mcp-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    }) as unknown as NextRequest;

    const res = await PUT(req, { params: Promise.resolve({ id: 'mcp-1' }) });

    expect(res.status).toBe(200);
    expect(syncRuntimeFromAdminStateMock).toHaveBeenCalledTimes(1);
  });

  it('syncs runtime after an MCP server delete', async () => {
    const res = await DELETE({} as NextRequest, { params: Promise.resolve({ id: 'mcp-1' }) });

    expect(res.status).toBe(200);
    expect(syncRuntimeFromAdminStateMock).toHaveBeenCalledTimes(1);
  });
});
