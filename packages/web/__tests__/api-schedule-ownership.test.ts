import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const requireSignedInMock = vi.hoisted(() => vi.fn());
const assertCanAccessAgentMock = vi.hoisted(() => vi.fn());
const writeAuditEventMock = vi.hoisted(() => vi.fn());
const requestMock = vi.hoisted(() => vi.fn());

vi.mock('../src/lib/api-guard', () => ({
  requireSignedIn: requireSignedInMock,
  assertCanAccessAgent: assertCanAccessAgentMock,
}));

vi.mock('../src/lib/admin-db', () => ({
  writeAuditEvent: writeAuditEventMock,
}));

vi.mock('../src/lib/gateway-client', () => ({
  getGatewayClient: vi.fn(() => ({
    request: requestMock,
  })),
}));

import { GET, POST } from '../src/app/api/schedule/route';

function req(body: unknown): NextRequest {
  return new Request('http://localhost:3000/api/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe('/api/schedule ownership and scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSignedInMock.mockResolvedValue({
      userId: 'user-1',
      role: 'user',
      agentId: 'agent-own',
      email: 'u@example.com',
    });
    assertCanAccessAgentMock.mockImplementation(() => undefined);
  });

  it('GET filters schedules to actor-owned jobs', async () => {
    requestMock.mockResolvedValueOnce({
      jobs: [
        { id: '1', name: '[owner:user-1] [agent:agent-own] Daily' },
        { id: '2', name: '[owner:user-2] [agent:agent-other] Daily' },
      ],
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.jobs).toHaveLength(1);
    expect(data.jobs[0].id).toBe('1');
  });

  it('denies update for non-owned schedule and writes deny audit', async () => {
    requestMock.mockResolvedValueOnce({
      jobs: [{ id: 'j-2', name: '[owner:user-2] [agent:agent-other] Daily' }],
    });

    const res = await POST(req({ action: 'update', jobId: 'j-2', enabled: false }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('forbidden_schedule_access');
    expect(writeAuditEventMock).toHaveBeenCalled();
  });

  it('adds schedules with owner+agent prefix', async () => {
    requestMock.mockResolvedValueOnce({ ok: true });

    const res = await POST(req({ action: 'add', hour: 8, minute: 30, name: 'Morning' }));
    expect(res.status).toBe(200);

    const addCall = requestMock.mock.calls.find((c) => c[0] === 'cron.add');
    expect(addCall).toBeDefined();
    expect(String(addCall?.[1]?.job?.name || '')).toContain('[owner:user-1] [agent:agent-own]');
    expect(addCall?.[1]?.job?.schedule?.tz).toBe('UTC');
  });

  it('rejects invalid schedule timezones', async () => {
    const res = await POST(req({ action: 'add', hour: 8, minute: 30, tz: 'Mars/Olympus_Mons' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('validation_error');
  });
});
