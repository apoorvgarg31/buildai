import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const requireAdminMock = vi.hoisted(() => vi.fn());
const listToolPoliciesMock = vi.hoisted(() => vi.fn());
const updateToolPolicyMock = vi.hoisted(() => vi.fn());
const syncRuntimeFromAdminStateMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-guard', () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock('@/lib/admin-db', () => ({
  listToolPolicies: listToolPoliciesMock,
  updateToolPolicy: updateToolPolicyMock,
}));

vi.mock('@/lib/runtime-sync', () => ({
  syncRuntimeFromAdminState: syncRuntimeFromAdminStateMock,
}));

import { GET } from '../src/app/api/admin/tools/route';
import { PUT } from '../src/app/api/admin/tools/[name]/route';

describe('/api/admin/tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'admin@example.com' });
    syncRuntimeFromAdminStateMock.mockResolvedValue(undefined);
  });

  it('lists the admin tool policy', async () => {
    listToolPoliciesMock.mockReturnValue([
      { name: 'web_fetch', label: 'Web fetch', enabled: true },
      { name: 'browser', label: 'Browser', enabled: false },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(listToolPoliciesMock).toHaveBeenCalledTimes(1);
  });

  it('updates a supported tool toggle', async () => {
    updateToolPolicyMock.mockReturnValue({ name: 'browser', enabled: true });

    const req = new Request('http://localhost/api/admin/tools/browser', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    }) as unknown as NextRequest;

    const res = await PUT(req, { params: Promise.resolve({ name: 'browser' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enabled).toBe(true);
    expect(updateToolPolicyMock).toHaveBeenCalledWith('browser', { enabled: true });
    expect(syncRuntimeFromAdminStateMock).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown tool names', async () => {
    const req = new Request('http://localhost/api/admin/tools/not-a-tool', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    }) as unknown as NextRequest;

    const res = await PUT(req, { params: Promise.resolve({ name: 'not-a-tool' }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Unsupported tool');
    expect(updateToolPolicyMock).not.toHaveBeenCalled();
  });
});
