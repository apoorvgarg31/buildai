import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const requireSignedInMock = vi.hoisted(() => vi.fn());
const assertCanAccessAgentMock = vi.hoisted(() => vi.fn());
const writeAuditEventMock = vi.hoisted(() => vi.fn());
const requestRuntimeGatewayMock = vi.hoisted(() => vi.fn());

vi.mock('../src/lib/api-guard', () => ({
  requireSignedIn: requireSignedInMock,
  assertCanAccessAgent: assertCanAccessAgentMock,
}));

vi.mock('../src/lib/admin-db', () => ({
  writeAuditEvent: writeAuditEventMock,
}));

vi.mock('../src/lib/runtime-gateway', () => ({
  requestRuntimeGateway: requestRuntimeGatewayMock,
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
    requestRuntimeGatewayMock.mockResolvedValueOnce({
      jobs: [
        { id: '1', name: '[owner:user-1] [agent:agent-own] Daily' },
        { id: '2', name: '[owner:user-2] [agent:agent-other] Daily' },
      ],
    });
    requestRuntimeGatewayMock.mockResolvedValueOnce({ entries: [] });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.jobs).toHaveLength(1);
    expect(data.jobs[0].id).toBe('1');
  });

  it('includes recent run history for accessible jobs only', async () => {
    requestRuntimeGatewayMock.mockResolvedValueOnce({
      jobs: [
        { id: 'job-1', name: '[owner:user-1] [agent:agent-own] Daily' },
        { id: 'job-2', name: '[owner:user-2] [agent:agent-other] Daily' },
      ],
    });
    requestRuntimeGatewayMock.mockResolvedValueOnce({
      entries: [
        { jobId: 'job-1', action: 'finished', status: 'ok', ts: 1710000000000, summary: 'sent summary' },
      ],
    });

    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.jobs).toHaveLength(1);
    expect(data.jobs[0].recentRuns).toEqual([
      expect.objectContaining({ jobId: 'job-1', status: 'ok', summary: 'sent summary' }),
    ]);
    expect(requestRuntimeGatewayMock).toHaveBeenCalledWith('cron.runs', { jobId: 'job-1', limit: 5 });
    expect(requestRuntimeGatewayMock).not.toHaveBeenCalledWith('cron.runs', { jobId: 'job-2', limit: 5 });
  });

  it('denies update for non-owned schedule and writes deny audit', async () => {
    requestRuntimeGatewayMock.mockResolvedValueOnce({
      jobs: [{ id: 'j-2', name: '[owner:user-2] [agent:agent-other] Daily' }],
    });

    const res = await POST(req({ action: 'update', jobId: 'j-2', enabled: false }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('forbidden_schedule_access');
    expect(writeAuditEventMock).toHaveBeenCalled();
  });

  it('adds schedules with owner+agent prefix', async () => {
    requestRuntimeGatewayMock.mockResolvedValueOnce({ ok: true });

    const res = await POST(req({ action: 'add', hour: 8, minute: 30, name: 'Morning' }));
    expect(res.status).toBe(200);

    const addCall = requestRuntimeGatewayMock.mock.calls.find((c) => c[0] === 'cron.add');
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

  it('rejects out-of-range schedule times instead of silently clamping them', async () => {
    const tooEarly = await POST(req({ action: 'add', hour: -1, minute: 30, tz: 'UTC' }));
    const tooLate = await POST(req({ action: 'add', hour: 8, minute: 99, tz: 'UTC' }));

    expect(tooEarly.status).toBe(400);
    expect(tooLate.status).toBe(400);
  });

  it('requires an explicit boolean when enabling or disabling a job', async () => {
    const res = await POST(req({ action: 'update', jobId: 'job-1' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('validation_error');
    expect(requestRuntimeGatewayMock).not.toHaveBeenCalled();
  });

  it('hides partially scoped legacy jobs from non-admin users', async () => {
    requestRuntimeGatewayMock.mockResolvedValueOnce({
      jobs: [
        { id: 'legacy-user', name: '[owner:user-1] Legacy main-session job' },
        { id: 'owned', name: '[owner:user-1] [agent:agent-own] Daily' },
      ],
    });
    requestRuntimeGatewayMock.mockResolvedValueOnce({ entries: [] });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.jobs.map((job: { id: string }) => job.id)).toEqual(['owned']);
  });

  it('denies manual run of partially scoped legacy jobs for non-admin users', async () => {
    requestRuntimeGatewayMock.mockResolvedValueOnce({
      jobs: [{ id: 'legacy-user', name: '[owner:user-1] Legacy main-session job' }],
    });

    const res = await POST(req({ action: 'run', jobId: 'legacy-user' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('forbidden_schedule_access');
    expect(writeAuditEventMock).toHaveBeenCalled();
  });

  it('allows admins to run legacy unscoped jobs for cleanup and recovery', async () => {
    requireSignedInMock.mockResolvedValueOnce({
      userId: 'admin-1',
      role: 'admin',
      agentId: null,
      email: 'admin@example.com',
    });
    requestRuntimeGatewayMock.mockResolvedValueOnce({
      jobs: [{ id: 'legacy-admin', name: '[owner:user-1] Legacy main-session job' }],
    });
    requestRuntimeGatewayMock.mockResolvedValueOnce({ ok: true });

    const res = await POST(req({ action: 'run', jobId: 'legacy-admin' }));
    expect(res.status).toBe(200);
    expect(requestRuntimeGatewayMock).toHaveBeenCalledWith('cron.run', { jobId: 'legacy-admin' });
  });
});
