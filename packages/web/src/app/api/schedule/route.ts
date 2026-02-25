import { NextRequest, NextResponse } from 'next/server';
import { getGatewayClient } from '@/lib/gateway-client';
import { requireSignedIn } from '@/lib/api-guard';

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
};

function userJobPrefix(agentId: string | null): string {
  return agentId ? `[agent:${agentId}] ` : '';
}

export async function GET() {
  try {
    const actor = await requireSignedIn();
    const client = getGatewayClient();
    const res = await client.request('cron.list', { includeDisabled: true });

    const jobs = Array.isArray(res) ? res : (res as { jobs?: unknown[] })?.jobs || [];
    const filtered = actor.role === 'admin'
      ? jobs
      : jobs.filter((j) => {
          const name = String((j as { name?: string }).name || '');
          return actor.agentId ? name.startsWith(userJobPrefix(actor.agentId)) : false;
        });

    return NextResponse.json({ jobs: filtered });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load schedules' }, { status: 500 });
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
        return NextResponse.json({ error: 'hour and minute required' }, { status: 400 });
      }
      const hour = Math.max(0, Math.min(23, body.hour));
      const minute = Math.max(0, Math.min(59, body.minute));
      const tz = body.tz || 'Europe/London';
      const prefix = userJobPrefix(actor.agentId || null);

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

    if (action === 'update') {
      const jobId = body.jobId || body.id;
      if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });
      const out = await client.request('cron.update', { jobId, patch: { enabled: body.enabled } });
      return NextResponse.json({ ok: true, result: out });
    }

    if (action === 'remove') {
      const jobId = body.jobId || body.id;
      if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });
      const out = await client.request('cron.remove', { jobId });
      return NextResponse.json({ ok: true, result: out });
    }

    if (action === 'run') {
      const jobId = body.jobId || body.id;
      if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });
      const out = await client.request('cron.run', { jobId });
      return NextResponse.json({ ok: true, result: out });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Schedule operation failed' }, { status: 500 });
  }
}
