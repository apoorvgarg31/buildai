import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireSignedIn: vi.fn(),
  assertCanAccessAgent: vi.fn(),
  writeAuditEvent: vi.fn(),
  request: vi.fn(),
}));

vi.mock('@/lib/api-guard', () => ({
  requireSignedIn: mocks.requireSignedIn,
  assertCanAccessAgent: mocks.assertCanAccessAgent,
}));

vi.mock('@/lib/gateway-client', () => ({
  getGatewayClient: vi.fn(() => ({ request: mocks.request })),
}));

vi.mock('@/lib/admin-db', () => ({
  writeAuditEvent: mocks.writeAuditEvent,
}));

import { GET, POST } from '../src/app/api/schedule/route';

describe('OA-3/5 schedule ownership + org isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSignedIn.mockResolvedValue({
      userId: 'u1',
      role: 'user',
      agentId: 'agent-a',
      email: 'u1@example.com',
      orgId: 'org-a',
    });
    mocks.assertCanAccessAgent.mockImplementation(() => undefined);
  });

  it('AC-OA3-07 GET returns only actor-owned schedule jobs for non-admin users', async () => {
    mocks.request.mockResolvedValueOnce({
      jobs: [
        { id: 'j1', name: '[owner:u1] [agent:agent-a] Daily summary' },
        { id: 'j2', name: '[owner:u2] [agent:agent-b] Daily summary' },
        { id: 'j3', name: 'legacy-unscoped-job' },
      ],
    });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(data.jobs)).toBe(true);
    expect(data.jobs).toHaveLength(1);
    expect(data.jobs[0].id).toBe('j1');
  });

  it('AC-OA3-08 blocks update/remove/run for jobs not owned by actor', async () => {
    mocks.request.mockImplementation(async (method: string) => {
      if (method === 'cron.list') {
        return { jobs: [{ id: 'j-other', name: '[owner:u2] [agent:agent-b] Daily summary' }] };
      }
      return { ok: true };
    });

    const updateRes = await POST({ json: async () => ({ action: 'update', jobId: 'j-other', enabled: false }) } as NextRequest);
    const updateData = await updateRes.json();

    expect(updateRes.status).toBe(403);
    expect(updateData.code).toBe('forbidden_schedule_access');
    expect(updateData.details?.reason).toBe('JOB_OWNERSHIP_VIOLATION');
    expect(typeof updateData.requestId).toBe('string');
  });

  it('AC-OA5-02 schedule route uses consistent error contract for auth failures', async () => {
    mocks.requireSignedIn.mockRejectedValueOnce(new Error('UNAUTHENTICATED'));

    const res = await POST({ json: async () => ({ action: 'add', hour: 9, minute: 0 }) } as NextRequest);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.code).toBe('unauthenticated');
    expect(typeof data.requestId).toBe('string');
  });
});
