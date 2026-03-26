import { NextRequest, NextResponse } from 'next/server';
import { getGatewayClient } from '@/lib/gateway-client';
import { assertCanAccessAgent, requireSignedIn } from '@/lib/api-guard';
import { apiError } from '@/lib/api-error';
import { writeAuditEvent } from '@/lib/admin-db';

type ScheduleBody = {
  action?: 'add' | 'update' | 'remove' | 'run';
  jobId?: string;
  id?: string;
  name?: string;
  text?: string;
  hour?: number;
  minute?: number;
  tz?: string;
  enabled?: boolean;
  agentId?: string;
};

type CronJob = {
  jobId?: string;
  id?: string;
  name?: string;
  enabled?: boolean;
  schedule?: { kind?: string; expr?: string; tz?: string };
};

function jobIdOf(job: CronJob): string {
  return String(job.jobId || job.id || '');
}

function userJobPrefix(agentId: string, userId: string): string {
  return `[owner:${userId}] [agent:${agentId}] `;
}

function parseOwnerFromJobName(name: string): { ownerUserId: string | null; agentId: string | null } {
  const ownerMatch = /\[owner:([^\]]+)\]/.exec(name);
  const agentMatch = /\[agent:([^\]]+)\]/.exec(name);
  return {
    ownerUserId: ownerMatch?.[1] || null,
    agentId: agentMatch?.[1] || null,
  };
}

function getJobsPayload(res: unknown): CronJob[] {
  return (Array.isArray(res) ? res : (res as { jobs?: unknown[] })?.jobs || []) as CronJob[];
}

function canAccessJob(actor: Awaited<ReturnType<typeof requireSignedIn>>, job: CronJob): boolean {
  const name = String(job.name || '');
  const parsed = parseOwnerFromJobName(name);

  if (!parsed.agentId && !parsed.ownerUserId) {
    return actor.role === 'admin';
  }

  if (parsed.ownerUserId && parsed.ownerUserId !== actor.userId && actor.role !== 'admin') {
    return false;
  }

  if (parsed.agentId) {
    try {
      assertCanAccessAgent(actor, parsed.agentId);
    } catch {
      return false;
    }

    if (actor.role !== 'admin') {
      return actor.agentId === parsed.agentId;
    }
  }

  return true;
}

function auditDenied(actor: Awaited<ReturnType<typeof requireSignedIn>>, action: string, entityId: string, reason: string): void {
  writeAuditEvent({
    actorUserId: actor.userId,
    action,
    entityType: 'schedule_job',
    entityId,
    metadata: { reason },
  });
}

async function loadJobById(client: ReturnType<typeof getGatewayClient>, jobId: string): Promise<CronJob | null> {
  const listRes = await client.request('cron.list', { includeDisabled: true });
  const jobs = getJobsPayload(listRes);
  return jobs.find((j) => jobIdOf(j) === jobId) || null;
}

function normalizeTimeZone(tz: string | undefined): string {
  const candidate = tz?.trim();
  if (!candidate) return 'UTC';
  try {
    Intl.DateTimeFormat(undefined, { timeZone: candidate });
    return candidate;
  } catch {
    throw new Error('INVALID_TIMEZONE');
  }
}

export async function GET() {
  try {
    const actor = await requireSignedIn();
    const client = getGatewayClient();
    const res = await client.request('cron.list', { includeDisabled: true });

    const jobs = getJobsPayload(res);
    const filtered = jobs.filter((j) => canAccessJob(actor, j));

    return NextResponse.json({ jobs: filtered });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return apiError('unauthenticated', 'Not authenticated', 401);
    }
    return apiError('schedule_list_failed', 'Failed to load schedules', 500, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSignedIn();
    const body = (await request.json()) as ScheduleBody;
    const client = getGatewayClient();

    const action = body.action || 'add';

    if (action === 'add') {
      if (typeof body.hour !== 'number' || typeof body.minute !== 'number') {
        return apiError('validation_error', 'hour and minute required', 400);
      }
      const hour = Math.max(0, Math.min(23, body.hour));
      const minute = Math.max(0, Math.min(59, body.minute));
      let tz: string;
      try {
        tz = normalizeTimeZone(body.tz);
      } catch (err) {
        if (err instanceof Error && err.message === 'INVALID_TIMEZONE') {
          return apiError('validation_error', 'Invalid timezone', 400);
        }
        throw err;
      }
      const targetAgentId = body.agentId || actor.agentId;

      if (!targetAgentId) {
        return apiError('validation_error', 'No agent available for schedule owner', 400);
      }

      try {
        assertCanAccessAgent(actor, targetAgentId);
      } catch {
        auditDenied(actor, 'schedule.add.denied', targetAgentId, 'AGENT_ACCESS_DENIED');
        return apiError('forbidden_agent_access', 'Forbidden', 403, { reason: 'AGENT_ACCESS_DENIED' });
      }

      if (actor.role !== 'admin' && actor.agentId !== targetAgentId) {
        auditDenied(actor, 'schedule.add.denied', targetAgentId, 'AGENT_OWNERSHIP_MISMATCH');
        return apiError('forbidden_agent_access', 'Forbidden', 403, { reason: 'AGENT_OWNERSHIP_MISMATCH' });
      }

      const prefix = userJobPrefix(targetAgentId, actor.userId);
      const job = {
        name: `${prefix}${body.name || 'Daily summary'}`,
        schedule: { kind: 'cron', expr: `${minute} ${hour} * * *`, tz },
        payload: {
          kind: 'systemEvent',
          text: body.text || 'Reminder: review project updates and risks.',
        },
        sessionTarget: 'main',
        enabled: body.enabled ?? true,
      };

      const out = await client.request('cron.add', { job });
      return NextResponse.json({ ok: true, result: out });
    }

    if (action === 'update' || action === 'remove' || action === 'run') {
      const jobId = body.jobId || body.id;
      if (!jobId) return apiError('validation_error', 'jobId required', 400);

      const job = await loadJobById(client, jobId);
      if (!job) {
        return apiError('not_found', 'Schedule not found', 404, { jobId });
      }
      if (!canAccessJob(actor, job)) {
        auditDenied(actor, `schedule.${action}.denied`, jobId, 'JOB_OWNERSHIP_VIOLATION');
        return apiError('forbidden_schedule_access', 'Forbidden', 403, { reason: 'JOB_OWNERSHIP_VIOLATION', jobId });
      }

      if (action === 'update') {
        const out = await client.request('cron.update', { jobId, patch: { enabled: body.enabled } });
        return NextResponse.json({ ok: true, result: out });
      }

      if (action === 'remove') {
        const out = await client.request('cron.remove', { jobId });
        return NextResponse.json({ ok: true, result: out });
      }

      const out = await client.request('cron.run', { jobId });
      return NextResponse.json({ ok: true, result: out });
    }

    return apiError('validation_error', 'Invalid action', 400);
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return apiError('unauthenticated', 'Not authenticated', 401);
    }
    return apiError('schedule_operation_failed', 'Schedule operation failed', 500, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
