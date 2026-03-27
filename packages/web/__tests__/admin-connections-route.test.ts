import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const requireAdminMock = vi.hoisted(() => vi.fn());
const createConnectionMock = vi.hoisted(() => vi.fn());
const listConnectionsMock = vi.hoisted(() => vi.fn());
const syncRuntimeFromAdminStateMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-guard', () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock('@/lib/admin-db', () => ({
  createConnection: createConnectionMock,
  listConnections: listConnectionsMock,
}));

vi.mock('@/lib/runtime-sync', () => ({
  syncRuntimeFromAdminState: syncRuntimeFromAdminStateMock,
}));

import { GET, POST } from '../src/app/api/admin/connections/route';

describe('/api/admin/connections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'admin@example.com' });
    syncRuntimeFromAdminStateMock.mockResolvedValue(undefined);
  });

  it('rejects connector types outside the predefined catalog', async () => {
    const req = new Request('http://localhost/api/admin/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Custom Thing', type: 'unknown-app', config: {} }),
    }) as unknown as NextRequest;

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Unsupported connector type');
    expect(createConnectionMock).not.toHaveBeenCalled();
  });

  it('lists configured connectors for admins', async () => {
    listConnectionsMock.mockReturnValue([{ id: 'conn-1', name: 'Linear Workspace', type: 'linear' }]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([{ id: 'conn-1', name: 'Linear Workspace', type: 'linear' }]);
    expect(listConnectionsMock).toHaveBeenCalledTimes(1);
  });

  it('rejects POST requests that do not include the required fields', async () => {
    const req = new Request('http://localhost/api/admin/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'linear' }),
    }) as unknown as NextRequest;

    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'name and type are required' });
    expect(createConnectionMock).not.toHaveBeenCalled();
  });

  it('rejects retired infrastructure-only connector types', async () => {
    for (const type of ['documents', 'llm']) {
      const req = new Request('http://localhost/api/admin/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Retired ${type}`, type, config: {} }),
      }) as unknown as NextRequest;

      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain('Unsupported connector type');
    }

    expect(createConnectionMock).not.toHaveBeenCalled();
  });

  it('creates supported predefined connectors with an explicit auth mode', async () => {
    createConnectionMock.mockReturnValue({ id: 'conn-google', type: 'google_workspace', auth_mode: 'oauth_user' });

    const req = new Request('http://localhost/api/admin/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Google Workspace', type: 'google_workspace', authMode: 'oauth_user', config: {} }),
    }) as unknown as NextRequest;

    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(createConnectionMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Google Workspace',
      type: 'google_workspace',
      authMode: 'oauth_user',
    }));
    expect(syncRuntimeFromAdminStateMock).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when the caller is not authenticated', async () => {
    requireAdminMock.mockRejectedValueOnce(new Error('UNAUTHENTICATED'));

    const res = await GET();

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Not authenticated' });
  });

  it('returns 403 when the caller is not allowed to manage connections', async () => {
    requireAdminMock.mockRejectedValueOnce(new Error('FORBIDDEN'));

    const req = new Request('http://localhost/api/admin/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Linear', type: 'linear', config: {} }),
    }) as unknown as NextRequest;

    const res = await POST(req);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it('returns 500 when connection creation fails unexpectedly', async () => {
    createConnectionMock.mockImplementationOnce(() => {
      throw new Error('db offline');
    });

    const req = new Request('http://localhost/api/admin/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Linear', type: 'linear', config: {} }),
    }) as unknown as NextRequest;

    const res = await POST(req);

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to create connection' });
  });
});
