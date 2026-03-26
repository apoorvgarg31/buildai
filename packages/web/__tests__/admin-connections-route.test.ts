import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const requireAdminMock = vi.hoisted(() => vi.fn());
const createConnectionMock = vi.hoisted(() => vi.fn());
const listConnectionsMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-guard', () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock('@/lib/admin-db', () => ({
  createConnection: createConnectionMock,
  listConnections: listConnectionsMock,
}));

import { POST } from '../src/app/api/admin/connections/route';

describe('/api/admin/connections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'admin@example.com' });
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
  });
});
