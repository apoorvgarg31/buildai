"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell, SectionCard } from "./MiraShell";

type FileKey = "SOUL.md" | "USER.md" | "TOOLS.md" | "ACTIVE.md";

interface Props {
  agentId?: string;
}

interface Recommendation {
  skill: string;
  score: number;
  reasons: string[];
}

function parseSectionList(md: string, sectionTitle: string): string[] {
  const regex = new RegExp(`## ${sectionTitle}([\\s\\S]*?)(\\n## |$)`, "m");
  const block = md.match(regex)?.[1] || "";
  return block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("-"))
    .map((l) => l.replace(/^-\s*/, "").trim())
    .filter(Boolean);
}

function parseField(md: string, label: string): string {
  const line = md
    .split("\n")
    .find((l) => l.toLowerCase().startsWith(`- ${label.toLowerCase()}:`) || l.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  if (!line) return "";
  return line.split(":").slice(1).join(":").trim();
}

export default function PersonalityStudio({ agentId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<FileKey>("SOUL.md");
  const [mode, setMode] = useState<"guided" | "files">("guided");
  const [files, setFiles] = useState<Record<FileKey, string>>({
    "SOUL.md": "",
    "USER.md": "",
    "TOOLS.md": "",
    "ACTIVE.md": "",
  });
  const [quick, setQuick] = useState("");
  const [msg, setMsg] = useState("");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [quickStart, setQuickStart] = useState<string[]>([]);

  const userMd = files["USER.md"];
  const status = (userMd.match(/## Status\n([\s\S]*?)(\n## |$)/m)?.[1] || "").trim();
  const role = parseField(userMd, "Role");
  const systemsRaw = parseField(userMd, "Primary systems");
  const systems = systemsRaw.split("/").map((s) => s.trim()).filter(Boolean);
  const painPoints = parseSectionList(userMd, "Top Pain Points");

  useEffect(() => {
    let mounted = true;
    fetch(`/api/personality/files${agentId ? `?agentId=${encodeURIComponent(agentId)}` : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        if (data.files) {
          setFiles({
            "SOUL.md": data.files.SOUL || "",
            "USER.md": data.files.USER || "",
            "TOOLS.md": data.files.TOOLS || "",
            "ACTIVE.md": data.files.ACTIVE || "",
          });
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [agentId]);

  async function saveCurrent() {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/personality/files", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, file: tab, content: files[tab] }),
    });
    setSaving(false);
    setMsg(res.ok ? `${tab} saved.` : "Save failed.");
  }

  async function applyQuickUpdate(text?: string) {
    const instruction = (text ?? quick).trim();
    if (!instruction) return;

    setSaving(true);
    setMsg("");
    const res = await fetch("/api/personality/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, instruction }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    setMsg(data.message || (res.ok ? "Applied." : "Failed to apply update."));
    if (res.ok && !text) setQuick("");
  }

  async function refreshRecommendations() {
    setMsg("");
    const res = await fetch("/api/personality/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, role, systems, painPoints }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error || "Could not fetch recommendations.");
      return;
    }

    setRecommendations((data.top_recommendations || []) as Recommendation[]);
    setQuickStart((data.quick_start || []) as string[]);
  }

  const statusBadge = useMemo(() => {
    const v = status.toLowerCase();
    if (v.includes("onboarded") || v.includes("completed")) return "bg-emerald-100 text-emerald-700";
    if (v.includes("pending")) return "bg-amber-100 text-amber-700";
    return "bg-slate-100 text-slate-700";
  }, [status]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading Personality Studio…</div>;
  }

  return (
    <PageShell
      title="Personality studio"
      subtitle="Tune tone, behavior, memory files, and recommended skill paths so each Mira agent feels deliberate instead of generic."
      eyebrow="User workspace"
      actions={
        <div className="inline-flex overflow-hidden rounded-full border border-slate-200 bg-white/75">
          <button onClick={() => setMode("guided")} className={`px-4 py-2 text-xs font-semibold ${mode === "guided" ? "bg-slate-950 text-white" : "text-slate-600"}`}>Guided</button>
          <button onClick={() => setMode("files")} className={`px-4 py-2 text-xs font-semibold ${mode === "files" ? "bg-slate-950 text-white" : "text-slate-600"}`}>Files</button>
        </div>
      }
    >
      <div className="mx-auto max-w-6xl space-y-5">
        {mode === "guided" ? (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="space-y-5 xl:col-span-2">
              <SectionCard>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`mira-pill ${statusBadge}`}>Status: {status || "unknown"}</span>
                  <span className="mira-pill bg-slate-100 text-slate-600">Role: {role || "not set"}</span>
                </div>
                <p className="mt-4 text-sm text-slate-600">Systems: {systems.length ? systems.join(", ") : "not captured yet"}</p>
                {painPoints.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                    {painPoints.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                )}
              </SectionCard>

              <SectionCard>
                <p className="mira-eyebrow">Quick personality command</p>
                <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">Direct the agent in one line</h2>
                <p className="mt-2 text-sm text-slate-600">Example: “Be more direct. Send an 8:30 AM digest. Alert only critical blockers.”</p>
                <textarea
                  value={quick}
                  onChange={(e) => setQuick(e.target.value)}
                  className="mira-textarea mt-4 min-h-[130px] px-4 py-4 text-sm"
                  placeholder="Tell your agent how to adapt..."
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => applyQuickUpdate()} disabled={saving || !quick.trim()} className="mira-button-primary px-4 py-2 text-sm font-semibold disabled:opacity-50">Apply update</button>
                  <button onClick={() => applyQuickUpdate("Use concise bullet updates. Keep tone direct and calm.")} disabled={saving} className="mira-button-secondary px-4 py-2 text-sm font-semibold">Set concise style</button>
                  <button onClick={() => applyQuickUpdate("Be proactive only for critical blockers and schedule slips.")} disabled={saving} className="mira-button-secondary px-4 py-2 text-sm font-semibold">Critical-only alerts</button>
                </div>
              </SectionCard>

              <SectionCard>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="mira-eyebrow">Skill guidance</p>
                    <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">Recommended skills</h2>
                  </div>
                  <button onClick={refreshRecommendations} className="mira-button-primary px-4 py-2 text-xs font-semibold">Refresh</button>
                </div>
                {quickStart.length > 0 && <p className="mt-3 text-sm text-slate-600">Quick start: {quickStart.join(" → ")}</p>}
                <div className="mt-4 space-y-3">
                  {recommendations.length === 0 ? (
                    <p className="text-sm text-slate-500">No recommendations yet. Click Refresh.</p>
                  ) : recommendations.map((r) => (
                    <div key={r.skill} className="mira-surface-muted rounded-[1.2rem] px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-950">{r.skill}</p>
                        <span className="mira-pill bg-slate-100 text-slate-600">score {r.score}</span>
                      </div>
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                        {r.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

            <div className="space-y-5">
              <SectionCard>
                <p className="mira-eyebrow">Why this matters</p>
                <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">Continuity and feel</h2>
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600">
                  <li>Replies become more aligned to the user’s working style.</li>
                  <li>Preferences persist through USER and ACTIVE memory files.</li>
                  <li>Onboarding can evolve without resetting the assistant.</li>
                </ul>
              </SectionCard>
              {msg && <SectionCard><p className="text-sm text-slate-600">{msg}</p></SectionCard>}
            </div>
          </div>
        ) : (
          <SectionCard className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/60 bg-white/60 px-4 py-3">
              {(["SOUL.md", "USER.md", "TOOLS.md", "ACTIVE.md"] as FileKey[]).map((f) => (
                <button key={f} onClick={() => setTab(f)} className={`rounded-full px-4 py-2 text-xs font-semibold ${tab === f ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {f}
                </button>
              ))}
              <div className="ml-auto">
                <button onClick={saveCurrent} disabled={saving} className="mira-button-primary px-4 py-2 text-xs font-semibold disabled:opacity-50">
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
            <textarea value={files[tab]} onChange={(e) => setFiles((p) => ({ ...p, [tab]: e.target.value }))} className="min-h-[600px] w-full bg-transparent p-5 font-mono text-xs outline-none" />
          </SectionCard>
        )}
      </div>
    </PageShell>
  );
}
