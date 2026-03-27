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
    expect(updateMcpServerMock).toHaveBeenCalledWith('mcp-1', { enabled: true });
    expect(syncRuntimeFromAdminStateMock).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when updating a missing MCP server', async () => {
    getMcpServerMock.mockReturnValueOnce(undefined);

    const req = new Request('http://localhost/api/admin/mcp-servers/missing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    }) as unknown as NextRequest;

    const res = await PUT(req, { params: Promise.resolve({ id: 'missing' }) });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Not found' });
    expect(updateMcpServerMock).not.toHaveBeenCalled();
  });

  it('returns 401 when MCP item routes are called without authentication', async () => {
    requireAdminMock.mockRejectedValueOnce(new Error('UNAUTHENTICATED'));

    const res = await DELETE({} as NextRequest, { params: Promise.resolve({ id: 'mcp-1' }) });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Not authenticated' });
  });

  it('returns 500 when an MCP item update fails unexpectedly', async () => {
    updateMcpServerMock.mockImplementationOnce(() => {
      throw new Error('db offline');
    });

    const req = new Request('http://localhost/api/admin/mcp-servers/mcp-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    }) as unknown as NextRequest;

    const res = await PUT(req, { params: Promise.resolve({ id: 'mcp-1' }) });

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to update MCP server' });
  });

  it('syncs runtime after an MCP server delete', async () => {
    const res = await DELETE({} as NextRequest, { params: Promise.resolve({ id: 'mcp-1' }) });

    expect(res.status).toBe(200);
    expect(deleteMcpServerMock).toHaveBeenCalledWith('mcp-1');
    expect(syncRuntimeFromAdminStateMock).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when deleting a missing MCP server', async () => {
    getMcpServerMock.mockReturnValueOnce(undefined);

    const res = await DELETE({} as NextRequest, { params: Promise.resolve({ id: 'missing' }) });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Not found' });
    expect(deleteMcpServerMock).not.toHaveBeenCalled();
  });
});
