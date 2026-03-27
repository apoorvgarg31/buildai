"use client";

import { useEffect, useState } from "react";
import { EmptyState, PageShell, SectionCard } from "./MiraShell";

type JobRun = {
  jobId?: string;
  status?: string;
  summary?: string;
  error?: string;
  ts?: number;
};

type Job = {
  jobId?: string;
  id?: string;
  name?: string;
  enabled?: boolean;
  schedule?: { kind?: string; expr?: string; tz?: string };
  recentRuns?: JobRun[];
};

function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function formatRunSummary(run: JobRun | undefined): string {
  if (!run) return "Not run yet";
  const status = run.status || "unknown";
  const when = typeof run.ts === "number" ? new Date(run.ts).toLocaleString() : "recently";
  const detail = run.summary || run.error || "No summary captured";
  return `Last run: ${status} · ${when} · ${detail}`;
}

export default function SchedulePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [name, setName] = useState("Morning Project Digest");
  const [text, setText] = useState("Send me a short morning project summary with risks and blockers.");
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(30);
  const [msg, setMsg] = useState("");
  const localTimeZone = getLocalTimeZone();

  async function load() {
    const res = await fetch("/api/schedule");
    const data = await res.json();
    setJobs(data.jobs || []);
  }

  useEffect(() => {
    let mounted = true;
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((data) => {
        if (mounted) setJobs(data.jobs || []);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function addJob() {
    const res = await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", name, text, hour, minute, tz: localTimeZone }),
    });
    const data = await res.json();
    setMsg(res.ok ? "Schedule created." : data.error || "Failed");
    if (res.ok) load();
  }

  async function toggle(job: Job) {
    const jobId = job.jobId || job.id;
    if (!jobId) return;
    const res = await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", jobId, enabled: !job.enabled }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Schedule ${job.enabled ? "paused" : "resumed"}.` : data.error || "Failed to update schedule.");
    if (res.ok) load();
  }

  async function runNow(job: Job) {
    const jobId = job.jobId || job.id;
    if (!jobId) return;
    const res = await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run", jobId }),
    });
    setMsg(res.ok ? "Triggered." : "Run failed.");
    if (res.ok) load();
  }

  async function remove(job: Job) {
    const jobId = job.jobId || job.id;
    if (!jobId) return;
    const res = await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", jobId }),
    });
    const data = await res.json();
    setMsg(res.ok ? "Schedule deleted." : data.error || "Failed to delete schedule.");
    if (res.ok) load();
  }

  return (
    <PageShell title="Automation" subtitle="Program recurring nudges and scheduled digests with the same restrained Mira treatment as the rest of the app." eyebrow="Schedules">
      <div className="mx-auto max-w-5xl space-y-5">
        <SectionCard className="grid gap-3 md:grid-cols-6">
          <div className="md:col-span-6 rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3 text-xs font-medium text-slate-600">
            Runs daily in {localTimeZone}
          </div>
          <input className="mira-input md:col-span-2 px-4 py-3 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Schedule name" />
          <input className="mira-input md:col-span-2 px-4 py-3 text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder="Reminder text" />
          <input type="number" className="mira-input px-4 py-3 text-sm" value={hour} onChange={(e) => setHour(Number(e.target.value))} min={0} max={23} />
          <input type="number" className="mira-input px-4 py-3 text-sm" value={minute} onChange={(e) => setMinute(Number(e.target.value))} min={0} max={59} />
          <button onClick={addJob} className="mira-button-primary md:col-span-6 px-4 py-3 text-sm font-semibold">Create daily schedule</button>
        </SectionCard>
        {msg && <p className="px-1 text-xs font-medium text-slate-500">{msg}</p>}
        {jobs.length === 0 ? <EmptyState icon="◷" title="No automations yet" description="Create your first recurring briefing or workflow and it will appear here with run, pause, and delete controls." /> : <div className="space-y-3">{jobs.map((j) => <SectionCard key={j.jobId || j.id} className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-slate-950">{j.name || "Unnamed schedule"}</p><p className="mt-1 text-xs text-slate-500">{j.schedule?.expr || j.schedule?.kind || "schedule"} {j.schedule?.tz ? `(${j.schedule.tz})` : ""}</p><p className="mt-2 text-xs font-medium text-slate-500">{formatRunSummary(j.recentRuns?.[j.recentRuns.length - 1])}</p></div><div className="flex items-center gap-2"><button onClick={() => runNow(j)} className="mira-button-secondary px-4 py-2 text-xs font-semibold">Run now</button><button onClick={() => toggle(j)} className="mira-button-secondary px-4 py-2 text-xs font-semibold">{j.enabled ? "Pause" : "Resume"}</button><button onClick={() => remove(j)} className="rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600">Delete</button></div></SectionCard>)}</div>}
      </div>
    </PageShell>
  );
}
