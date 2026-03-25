"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell, SectionCard, EmptyState } from "./MiraShell";
import { BuildAIUser } from "@/lib/user";

interface AdminDashboardProps {
  user: BuildAIUser;
}

interface Stats {
  users: { total: number; admins: number };
  connections: { total: number; connected: number };
  agents: { total: number; active: number };
  recentUsers: { id: string; name: string; email: string; role: string; agent_id: string | null }[];
  recentConnections: { id: string; name: string; type: string; status: string }[];
}

const statusPill: Record<string, string> = {
  connected: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  error: "bg-rose-100 text-rose-700",
  active: "bg-emerald-100 text-emerald-700",
};

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cards = useMemo(
    () => [
      {
        label: "Users",
        value: stats?.users.total ?? "—",
        detail: stats ? `${stats.users.admins} admin${stats.users.admins === 1 ? "" : "s"}` : "",
        icon: "◌",
      },
      {
        label: "Agents",
        value: stats?.agents.total ?? "—",
        detail: stats ? `${stats.agents.active} active` : "",
        icon: "✦",
      },
      {
        label: "Connections",
        value: stats?.connections.total ?? "—",
        detail: stats ? `${stats.connections.connected} connected` : "",
        icon: "⟷",
      },
      {
        label: "Engine",
        value: "Online",
        detail: "Runtime healthy",
        icon: "⚡",
      },
    ],
    [stats]
  );

  return (
    <PageShell
      title="Admin command"
      subtitle={`Operational visibility for ${user.name}, with a cleaner Mira layer over people, agents, and integrations.`}
      eyebrow="Admin workspace"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <SectionCard key={card.label} className="relative overflow-hidden">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-400">{card.label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-slate-950">{loading ? "…" : card.value}</p>
                  <p className="mt-2 text-sm text-slate-500">{card.detail}</p>
                </div>
                <div className="mira-icon-chip shrink-0 text-lg">{card.icon}</div>
              </div>
            </SectionCard>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <SectionCard>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="mira-eyebrow">Team members</p>
                <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">People in the workspace</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {loading ? (
                <p className="text-sm text-slate-500">Loading users…</p>
              ) : (stats?.recentUsers ?? []).length === 0 ? (
                <EmptyState icon="◌" title="No users yet" description="Invite users from the Users surface to start assigning access, agents, and org roles." />
              ) : (
                (stats?.recentUsers ?? []).map((member) => (
                  <div key={member.id} className="mira-surface-muted flex items-center justify-between gap-3 rounded-[1.2rem] px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{member.name}</p>
                      <p className="truncate text-xs text-slate-500">{member.email}</p>
                    </div>
                    <span className={`mira-pill ${member.role === "admin" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"}`}>
                      {member.role}
                    </span>
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          <SectionCard>
            <div>
              <p className="mira-eyebrow">Integrations</p>
              <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">Connection health</h2>
            </div>
            <div className="mt-5 space-y-3">
              {loading ? (
                <p className="text-sm text-slate-500">Loading connections…</p>
              ) : (stats?.recentConnections ?? []).length === 0 ? (
                <EmptyState icon="⟷" title="No integrations yet" description="Add PMIS, database, or document connections to give Mira real project context." />
              ) : (
                (stats?.recentConnections ?? []).map((connection) => (
                  <div key={connection.id} className="mira-surface-muted flex items-center justify-between gap-3 rounded-[1.2rem] px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{connection.name}</p>
                      <p className="text-xs text-slate-500">{connection.type}</p>
                    </div>
                    <span className={`mira-pill ${statusPill[connection.status] || "bg-slate-100 text-slate-600"}`}>
                      {connection.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </PageShell>
  );
}
