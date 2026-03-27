import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const requireAdminMock = vi.hoisted(() => vi.fn());
const getAdminSettingsMock = vi.hoisted(() => vi.fn());
const updateAdminSettingsMock = vi.hoisted(() => vi.fn());
const syncRuntimeFromAdminStateMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-guard', () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock('@/lib/admin-settings', () => ({
  getAdminSettings: getAdminSettingsMock,
  updateAdminSettings: updateAdminSettingsMock,
}));

vi.mock('@/lib/runtime-sync', () => ({
  syncRuntimeFromAdminState: syncRuntimeFromAdminStateMock,
}));

import { GET, PUT } from '../src/app/api/admin/settings/route';

describe('/api/admin/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'admin@example.com' });
    getAdminSettingsMock.mockReturnValue({
      companyName: 'Mira',
      defaultModel: 'google/gemini-2.0-flash',
      responseStyle: 'professional',
      maxQueriesPerDay: 500,
      maxAgents: 10,
      dataRetentionDays: 90,
      hasSharedApiKey: false,
      sharedApiKey: null,
    });
    updateAdminSettingsMock.mockReturnValue({
      companyName: 'Mira Command',
      defaultModel: 'openai/gpt-4o',
      responseStyle: 'detailed',
      maxQueriesPerDay: 700,
      maxAgents: 25,
      dataRetentionDays: 120,
      hasSharedApiKey: true,
      sharedApiKey: 'shared-admin-key',
    });
    syncRuntimeFromAdminStateMock.mockResolvedValue(undefined);
  });

  it('returns the persisted admin settings', async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.defaultModel).toBe('google/gemini-2.0-flash');
    expect(body.hasSharedApiKey).toBe(false);
  });

  it('updates admin settings and syncs runtime state', async () => {
    const req = new Request('http://localhost/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Mira Command',
        defaultModel: 'openai/gpt-4o',
        responseStyle: 'detailed',
        maxQueriesPerDay: 700,
        maxAgents: 25,
        dataRetentionDays: 120,
        sharedApiKey: 'shared-admin-key',
      }),
    }) as unknown as NextRequest;

    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(updateAdminSettingsMock).toHaveBeenCalledWith(expect.objectContaining({
      defaultModel: 'openai/gpt-4o',
      sharedApiKey: 'shared-admin-key',
    }));
    expect(syncRuntimeFromAdminStateMock).toHaveBeenCalledTimes(1);
    expect(body.hasSharedApiKey).toBe(true);
    expect(body.sharedApiKey).toBeUndefined();
  });
});
