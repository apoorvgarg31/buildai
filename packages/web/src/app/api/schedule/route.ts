import { NextRequest, NextResponse } from 'next/server';
import { requestRuntimeGateway } from '@/lib/runtime-gateway';
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

type CronRunEntry = {
  jobId?: string;
  action?: string;
  status?: string;
  summary?: string;
  error?: string;
  ts?: number;
  durationMs?: number;
};

type CronJob = {
  jobId?: string;
  id?: string;
  name?: string;
  enabled?: boolean;
  schedule?: { kind?: string; expr?: string; tz?: string };
  recentRuns?: CronRunEntry[];
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

function getRunsPayload(res: unknown): CronRunEntry[] {
  return (Array.isArray(res) ? res : (res as { entries?: unknown[] })?.entries || []) as CronRunEntry[];
}

function canAccessJob(actor: Awaited<ReturnType<typeof requireSignedIn>>, job: CronJob): boolean {
  const name = String(job.name || '');
  const parsed = parseOwnerFromJobName(name);

  if (!parsed.agentId || !parsed.ownerUserId) {
    return actor.role === 'admin';
  }

  if (parsed.ownerUserId !== actor.userId && actor.role !== 'admin') {
    return false;
  }

  try {
    assertCanAccessAgent(actor, parsed.agentId);
  } catch {
    return false;
  }

  if (actor.role !== 'admin') {
    return actor.agentId === parsed.agentId;
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

async function loadAllJobs(): Promise<CronJob[]> {
  const listRes = await requestRuntimeGateway('cron.list', { includeDisabled: true });
  return getJobsPayload(listRes);
}

async function loadJobById(jobId: string): Promise<CronJob | null> {
  const jobs = await loadAllJobs();
  return jobs.find((job) => jobIdOf(job) === jobId) || null;
}

async function loadRecentRuns(jobId: string): Promise<CronRunEntry[]> {
  if (!jobId) return [];
  try {
    const runsRes = await requestRuntimeGateway('cron.runs', { jobId, limit: 5 });
    return getRunsPayload(runsRes);
  } catch {
    return [];
  }
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

function isValidHour(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23;
}

function isValidMinute(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 59;
}

export async function GET() {
  try {
    const actor = await requireSignedIn();
    const jobs = await loadAllJobs();
    const filtered = jobs.filter((job) => canAccessJob(actor, job));
    const hydrated = await Promise.all(filtered.map(async (job) => ({
      ...job,
      recentRuns: await loadRecentRuns(jobIdOf(job)),
    })));

    return NextResponse.json({ jobs: hydrated });
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

    const action = body.action || 'add';

    if (action === 'add') {
      if (!isValidHour(body.hour) || !isValidMinute(body.minute)) {
        return apiError('validation_error', 'hour must be 0-23 and minute must be 0-59', 400);
      }
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
        schedule: { kind: 'cron', expr: `${body.minute} ${body.hour} * * *`, tz },
        payload: {
          kind: 'systemEvent',
          text: body.text || 'Reminder: review project updates and risks.',
        },
        sessionTarget: 'main',
        enabled: body.enabled ?? true,
      };

      const out = await requestRuntimeGateway('cron.add', { job });
      return NextResponse.json({ ok: true, result: out });
    }

    if (action === 'update' || action === 'remove' || action === 'run') {
      const jobId = body.jobId || body.id;
      if (!jobId) return apiError('validation_error', 'jobId required', 400);
      if (action === 'update' && typeof body.enabled !== 'boolean') {
        return apiError('validation_error', 'enabled must be a boolean', 400);
      }

      const job = await loadJobById(jobId);
      if (!job) {
        return apiError('not_found', 'Schedule not found', 404, { jobId });
      }
      if (!canAccessJob(actor, job)) {
        auditDenied(actor, `schedule.${action}.denied`, jobId, 'JOB_OWNERSHIP_VIOLATION');
        return apiError('forbidden_schedule_access', 'Forbidden', 403, { reason: 'JOB_OWNERSHIP_VIOLATION', jobId });
      }

      if (action === 'update') {
        const out = await requestRuntimeGateway('cron.update', { jobId, patch: { enabled: body.enabled } });
        return NextResponse.json({ ok: true, result: out });
      }

      if (action === 'remove') {
        const out = await requestRuntimeGateway('cron.remove', { jobId });
        return NextResponse.json({ ok: true, result: out });
      }

      const out = await requestRuntimeGateway('cron.run', { jobId });
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
