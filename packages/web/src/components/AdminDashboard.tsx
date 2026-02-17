"use client";

import { useState, useEffect } from "react";
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

const statusColors: Record<string, string> = {
  connected: "text-emerald-400 bg-emerald-500/10",
  pending: "text-[#171717] bg-[#171717]/10",
  error: "text-red-400 bg-red-500/10",
  active: "text-emerald-400 bg-emerald-500/10",
};

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: "Active Users", value: stats?.users.total ?? "—", icon: "👥", sub: stats ? `${stats.users.admins} admin${stats.users.admins !== 1 ? "s" : ""}` : "", color: "from-blue-500/10 to-blue-600/5 border-blue-500/10" },
    { label: "AI Agents", value: stats?.agents.total ?? "—", icon: "🤖", sub: stats ? `${stats.agents.active} active` : "", color: "from-emerald-500/10 to-emerald-600/5 border-emerald-500/10" },
    { label: "Connections", value: stats?.connections.total ?? "—", icon: "🔗", sub: stats ? `${stats.connections.connected} connected` : "", color: "from-amber-500/10 to-amber-600/5 border-amber-500/10" },
    { label: "Engine", value: "Online", icon: "⚡", sub: "Port 18790", color: "from-purple-500/10 to-purple-600/5 border-purple-500/10" },
  ];

  return (
    <div className="flex flex-col h-full bg-white overflow-y-auto">
      <header className="flex items-center justify-between pl-14 pr-6 lg:px-6 h-14 border-b border-black/5 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-[#171717]">Dashboard</h2>
          <p className="text-[11px] text-[#8e8e8e]">Welcome back, {user.name}</p>
        </div>
      </header>

      <div className="px-6 py-5 max-w-6xl mx-auto w-full space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map((s) => (
            <div key={s.label} className={`rounded-xl border bg-gradient-to-br ${s.color} p-4`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-[#8e8e8e]">{s.label}</span>
                <span className="text-lg">{s.icon}</span>
              </div>
              <p className="text-2xl font-bold text-[#171717]">{loading ? "…" : s.value}</p>
              <p className="text-[11px] text-[#8e8e8e] mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Users Table */}
          <div className="rounded-xl border border-black/5 bg-[#f9f9f9]">
            <div className="px-5 py-3 border-b border-black/5">
              <h3 className="text-[13px] font-semibold text-[#171717]">Team Members</h3>
            </div>
            <div className="divide-y divide-white/5">
              {loading ? (
                <div className="px-5 py-8 text-center text-[#8e8e8e] text-[12px]">Loading...</div>
              ) : (stats?.recentUsers ?? []).length === 0 ? (
                <div className="px-5 py-8 text-center text-[#8e8e8e] text-[12px]">No users yet — add users in the Users tab</div>
              ) : (
                (stats?.recentUsers ?? []).map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-5 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center text-[10px] font-semibold text-amber-300">
                        {u.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2)}
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-[#171717]">{u.name}</p>
                        <p className="text-[10px] text-[#8e8e8e]">{u.email}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      u.role === "admin" ? "text-purple-400 bg-purple-500/10" : "text-blue-400 bg-blue-500/10"
                    }`}>{u.role}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Connections Overview */}
          <div className="rounded-xl border border-black/5 bg-[#f9f9f9]">
            <div className="px-5 py-3 border-b border-black/5">
              <h3 className="text-[13px] font-semibold text-[#171717]">Connections</h3>
            </div>
            <div className="divide-y divide-white/5">
              {loading ? (
                <div className="px-5 py-8 text-center text-[#8e8e8e] text-[12px]">Loading...</div>
              ) : (stats?.recentConnections ?? []).length === 0 ? (
                <div className="px-5 py-8 text-center text-[#8e8e8e] text-[12px]">No connections yet — add connections in the Connections tab</div>
              ) : (
                (stats?.recentConnections ?? []).map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-5 py-2.5">
                    <div>
                      <p className="text-[12px] font-medium text-[#171717]">{c.name}</p>
                      <p className="text-[10px] text-[#8e8e8e]">{c.type}</p>
                    </div>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColors[c.status] || "text-[#8e8e8e] bg-gray-500/10"}`}>
                      {c.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
