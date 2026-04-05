"use client";

import { useEffect, useState } from "react";
import { SectionCard, PageShell } from "./MiraShell";

type Stats = {
  users: { total: number; admins: number };
  connections: { total: number; connected: number };
  agents: { total: number; active: number };
  tools: { total: number; enabled: number };
  mcpServers: { total: number; enabled: number };
};

export default function UsagePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { setStats(data || null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cards = loading
    ? [
        ["Users", "Loading…", "…"],
        ["Connections", "Loading…", "…"],
        ["Agents", "Loading…", "…"],
        ["Tools", "Loading…", "…"],
        ["MCP Servers", "Loading…", "…"],
        ["Artifacts", "Loading…", "…"],
      ]
    : [
        ["Users", `${stats?.users.total ?? "—"}`, `${stats?.users.admins ?? 0} admin${(stats?.users.admins ?? 0) > 1 ? "s" : ""}`],
        ["Connections", `${stats?.connections.total ?? "—"}`, `${stats?.connections.connected ?? 0} connected`],
        ["Agents", `${stats?.agents.total ?? "—"}`, `${stats?.agents.active ?? 0} active`],
        ["Tools", `${stats?.tools.total ?? "—"}`, `${stats?.tools.enabled ?? 0} enabled`],
        ["MCP Servers", `${stats?.mcpServers.total ?? "—"}`, `${stats?.mcpServers.enabled ?? 0} enabled`],
        ["Artifacts", "—", "Browse from chat artifacts bar"],
    ];

  return (
    <PageShell title="Usage intelligence" subtitle="Track how your workspace is using Mira across conversations, skills, and proactive automation." eyebrow="Analytics">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          {cards.map(([title, primary, secondary]) => (
            <SectionCard key={title as string} className="min-h-[120px]">
              <p className="mira-eyebrow text-slate-400">{title}</p>
              <h3 className="mt-2 text-3xl font-bold text-slate-950">{primary}</h3>
              <p className="mt-1 text-sm text-slate-500">{secondary}</p>
            </SectionCard>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
