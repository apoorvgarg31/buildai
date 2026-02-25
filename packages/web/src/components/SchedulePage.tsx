"use client";

import { useEffect, useState } from 'react';

type Job = {
  jobId?: string;
  id?: string;
  name?: string;
  enabled?: boolean;
  schedule?: { kind?: string; expr?: string; tz?: string };
};

export default function SchedulePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [name, setName] = useState('Morning Project Digest');
  const [text, setText] = useState('Send me a short morning project summary with risks and blockers.');
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(30);
  const [msg, setMsg] = useState('');

  async function load() {
    const res = await fetch('/api/schedule');
    const data = await res.json();
    setJobs(data.jobs || []);
  }

  useEffect(() => {
    let mounted = true;
    fetch('/api/schedule')
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        setJobs(data.jobs || []);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function addJob() {
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', name, text, hour, minute, tz: 'Europe/London' }),
    });
    const data = await res.json();
    setMsg(res.ok ? 'Schedule created.' : data.error || 'Failed');
    if (res.ok) load();
  }

  async function toggle(job: Job) {
    const jobId = job.jobId || job.id;
    if (!jobId) return;
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', jobId, enabled: !job.enabled }),
    });
    if (res.ok) load();
  }

  async function runNow(job: Job) {
    const jobId = job.jobId || job.id;
    if (!jobId) return;
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'run', jobId }),
    });
    setMsg(res.ok ? 'Triggered.' : 'Run failed.');
  }

  async function remove(job: Job) {
    const jobId = job.jobId || job.id;
    if (!jobId) return;
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove', jobId }),
    });
    if (res.ok) load();
  }

  return (
    <div className="h-full overflow-auto bg-white p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#171717]">Automation</h1>
          <p className="text-sm text-[#666] mt-1">Manage recurring assistant automations.</p>
        </div>

        <div className="rounded-2xl border border-black/10 p-4 grid grid-cols-1 md:grid-cols-6 gap-2">
          <input className="md:col-span-2 border border-black/10 rounded-xl px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Schedule name" />
          <input className="md:col-span-2 border border-black/10 rounded-xl px-3 py-2 text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder="Reminder text" />
          <input type="number" className="border border-black/10 rounded-xl px-3 py-2 text-sm" value={hour} onChange={(e) => setHour(Number(e.target.value))} min={0} max={23} />
          <input type="number" className="border border-black/10 rounded-xl px-3 py-2 text-sm" value={minute} onChange={(e) => setMinute(Number(e.target.value))} min={0} max={59} />
          <button onClick={addJob} className="md:col-span-6 rounded-xl bg-black text-white text-sm px-3 py-2">Create daily schedule</button>
        </div>

        {msg && <p className="text-xs text-[#666]">{msg}</p>}

        <div className="rounded-2xl border border-black/10 divide-y divide-black/5">
          {jobs.length === 0 ? (
            <p className="p-4 text-sm text-[#777]">No schedules yet.</p>
          ) : jobs.map((j) => (
            <div key={j.jobId || j.id} className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#171717]">{j.name || 'Unnamed schedule'}</p>
                <p className="text-xs text-[#666]">{j.schedule?.expr || j.schedule?.kind || 'schedule'} {j.schedule?.tz ? `(${j.schedule.tz})` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => runNow(j)} className="text-xs px-2 py-1 rounded-lg border border-black/10">Run now</button>
                <button onClick={() => toggle(j)} className="text-xs px-2 py-1 rounded-lg border border-black/10">{j.enabled ? 'Pause' : 'Resume'}</button>
                <button onClick={() => remove(j)} className="text-xs px-2 py-1 rounded-lg border border-black/10">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
