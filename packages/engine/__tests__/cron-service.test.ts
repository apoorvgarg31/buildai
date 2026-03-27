import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CronService } from '../dist/cron/service.js';
import { appendCronRunLog, readCronRunLogEntries, resolveCronRunLogPath } from '../dist/cron/run-log.js';

function noopLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

async function waitFor(check: () => Promise<boolean>, timeoutMs = 2500): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out after ${timeoutMs}ms`);
}

describe('CronService end-to-end execution', () => {
  const cleanup: Array<() => void> = [];

  afterEach(() => {
    while (cleanup.length > 0) {
      cleanup.pop()?.();
    }
    vi.restoreAllMocks();
  });

  function createHarness() {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'buildai-cron-service-'));
    const storePath = path.join(tmpRoot, 'cron', 'jobs.json');
    const enqueueSystemEvent = vi.fn();
    const requestHeartbeatNow = vi.fn();
    const runHeartbeatOnce = vi.fn(async () => ({ status: 'ran' as const }));
    const runIsolatedAgentJob = vi.fn(async () => ({ status: 'ok' as const, summary: 'isolated ok', outputText: 'isolated ok' }));
    const log = noopLogger();

    const cron = new CronService({
      storePath,
      cronEnabled: true,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runHeartbeatOnce,
      runIsolatedAgentJob,
      log,
      onEvent: (evt) => {
        if (evt.action !== 'finished') return;
        const logPath = resolveCronRunLogPath({ storePath, jobId: evt.jobId });
        void appendCronRunLog(logPath, {
          ts: Date.now(),
          jobId: evt.jobId,
          action: 'finished',
          status: evt.status,
          error: evt.error,
          summary: evt.summary,
          runAtMs: evt.runAtMs,
          durationMs: evt.durationMs,
          nextRunAtMs: evt.nextRunAtMs,
        });
      },
    });

    cleanup.push(() => cron.stop());
    cleanup.push(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

    return {
      cron,
      storePath,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runHeartbeatOnce,
      runIsolatedAgentJob,
    };
  }

  it('executes a scheduled main-session job automatically and writes run history', async () => {
    const { cron, storePath, enqueueSystemEvent, runHeartbeatOnce, requestHeartbeatNow } = createHarness();
    await cron.start();

    const job = await cron.add({
      name: 'Morning reminder',
      schedule: { kind: 'at', atMs: Date.now() + 50 },
      sessionTarget: 'main',
      wakeMode: 'now',
      payload: { kind: 'systemEvent', text: 'Reminder: check the project dashboard.' },
    });

    const logPath = resolveCronRunLogPath({ storePath, jobId: job.id });
    await waitFor(async () => {
      const entries = await readCronRunLogEntries(logPath, { jobId: job.id, limit: 5 });
      return entries.length === 1;
    });

    const entries = await readCronRunLogEntries(logPath, { jobId: job.id, limit: 5 });
    const stored = await cron.list({ includeDisabled: true });
    const executedJob = stored.find((item) => item.id === job.id);

    expect(enqueueSystemEvent).toHaveBeenCalledWith('Reminder: check the project dashboard.', { agentId: undefined });
    expect(runHeartbeatOnce).toHaveBeenCalled();
    expect(requestHeartbeatNow).not.toHaveBeenCalled();
    expect(entries[0]).toMatchObject({
      jobId: job.id,
      action: 'finished',
      status: 'ok',
      summary: 'Reminder: check the project dashboard.',
    });
    expect(executedJob?.enabled).toBe(false);
    expect(executedJob?.state?.lastStatus).toBe('ok');
  });

  it('supports timezone-preserving schedule lifecycle: list, disable, re-enable, force-run, and remove', async () => {
    const { cron, storePath, enqueueSystemEvent, requestHeartbeatNow } = createHarness();
    await cron.start();

    const job = await cron.add({
      name: 'Timezone digest',
      schedule: { kind: 'cron', expr: '0 9 * * *', tz: 'Asia/Kolkata' },
      sessionTarget: 'main',
      wakeMode: 'next-heartbeat',
      payload: { kind: 'systemEvent', text: 'Digest for the local workday.' },
    });

    let visible = await cron.list();
    expect(visible.map((item) => item.id)).toContain(job.id);
    expect(visible.find((item) => item.id === job.id)?.schedule?.tz).toBe('Asia/Kolkata');

    await cron.update(job.id, { enabled: false });
    visible = await cron.list();
    expect(visible.map((item) => item.id)).not.toContain(job.id);
    expect((await cron.list({ includeDisabled: true })).find((item) => item.id === job.id)?.enabled).toBe(false);

    await cron.update(job.id, { enabled: true });
    const runResult = await cron.run(job.id, 'force');
    expect(runResult).toMatchObject({ ok: true, ran: true });
    expect(enqueueSystemEvent).toHaveBeenCalledWith('Digest for the local workday.', { agentId: undefined });
    expect(requestHeartbeatNow).toHaveBeenCalledWith({ reason: `cron:${job.id}` });

    const entries = await readCronRunLogEntries(resolveCronRunLogPath({ storePath, jobId: job.id }), { jobId: job.id, limit: 5 });
    expect(entries[entries.length - 1]).toMatchObject({ jobId: job.id, status: 'ok' });

    const removeResult = await cron.remove(job.id);
    expect(removeResult).toMatchObject({ ok: true, removed: true });
    expect((await cron.list({ includeDisabled: true })).find((item) => item.id === job.id)).toBeUndefined();
  });

  it('records skipped history for invalid main-session payloads instead of pretending the job ran', async () => {
    const { cron, storePath, enqueueSystemEvent } = createHarness();
    await cron.start();

    const job = await cron.add({
      name: 'Broken reminder',
      schedule: { kind: 'at', atMs: Date.now() + 10_000 },
      sessionTarget: 'main',
      wakeMode: 'now',
      payload: { kind: 'systemEvent', text: '   ' },
    });

    const result = await cron.run(job.id, 'force');
    const entries = await readCronRunLogEntries(resolveCronRunLogPath({ storePath, jobId: job.id }), { jobId: job.id, limit: 5 });

    expect(result).toMatchObject({ ok: true, ran: true });
    expect(enqueueSystemEvent).not.toHaveBeenCalled();
    expect(entries[entries.length - 1]).toMatchObject({
      jobId: job.id,
      status: 'skipped',
      error: 'main job requires non-empty systemEvent text',
    });
  });
});
