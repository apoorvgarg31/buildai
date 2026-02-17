"use client";

import { DemoUser } from "@/lib/auth";

interface AdminDashboardProps {
  user: DemoUser;
}

const stats = [
  { label: "Active Users", value: "24", icon: "👥", change: "+3 this week", color: "from-blue-500/10 to-blue-600/5 border-blue-500/10" },
  { label: "AI Agents", value: "24", icon: "🤖", change: "All healthy", color: "from-emerald-500/10 to-emerald-600/5 border-emerald-500/10" },
  { label: "Connections", value: "6", icon: "🔗", change: "2 pending", color: "from-amber-500/10 to-amber-600/5 border-amber-500/10" },
  { label: "Queries Today", value: "1,847", icon: "💬", change: "+12%", color: "from-purple-500/10 to-purple-600/5 border-purple-500/10" },
];

const recentUsers = [
  { name: "Mike Torres", role: "Senior PM", projects: 3, status: "active", queries: 142 },
  { name: "Lisa Park", role: "Project Manager", projects: 2, status: "active", queries: 89 },
  { name: "James Wright", role: "Project Engineer", projects: 1, status: "active", queries: 67 },
  { name: "Ana Rodriguez", role: "PM Director", projects: 5, status: "active", queries: 203 },
  { name: "David Kim", role: "Project Manager", projects: 2, status: "inactive", queries: 12 },
];

const connections = [
  { name: "Procore", type: "PMIS", status: "connected", users: 24 },
  { name: "PostgreSQL", type: "Database", status: "connected", users: 24 },
  { name: "Gemini 2.0 Flash", type: "LLM Provider", status: "connected", users: 24 },
  { name: "Primavera P6", type: "Scheduling", status: "pending", users: 0 },
  { name: "Unifier", type: "Cost Mgmt", status: "pending", users: 0 },
  { name: "SharePoint", type: "Documents", status: "connected", users: 18 },
];

export default function AdminDashboard({ user }: AdminDashboardProps) {
  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Header */}
      <header className="flex items-center justify-between pl-14 pr-6 lg:px-6 h-14 border-b border-white/5">
        <div>
          <h2 className="text-sm font-semibold text-white">Dashboard</h2>
          <p className="text-[11px] text-gray-500">Welcome back, {user.name}</p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((stat) => (
              <div key={stat.label} className={`rounded-xl border bg-gradient-to-br ${stat.color} p-4`}>
                <div className="flex items-center justify-between">
                  <span className="text-xl">{stat.icon}</span>
                  <span className="text-[11px] font-medium text-emerald-400">{stat.change}</span>
                </div>
                <p className="text-2xl font-bold text-white mt-2">{stat.value}</p>
                <p className="text-[12px] text-gray-400 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Users */}
            <div className="rounded-xl border border-white/5 bg-[#171717] p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Team Members</h3>
                <button className="text-[12px] text-amber-400 hover:text-amber-300 font-medium">View all →</button>
              </div>
              <div className="space-y-1">
                {recentUsers.map((u) => (
                  <div key={u.name} className="flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-[11px] font-semibold text-white">
                        {u.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-gray-200">{u.name}</p>
                        <p className="text-[11px] text-gray-500">{u.role} · {u.projects} projects</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${u.status === "active" ? "text-emerald-400" : "text-gray-500"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.status === "active" ? "bg-emerald-400" : "bg-gray-600"}`} />
                        {u.status}
                      </span>
                      <p className="text-[11px] text-gray-600">{u.queries} queries</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Connections */}
            <div className="rounded-xl border border-white/5 bg-[#171717] p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Connections</h3>
                <button className="text-[12px] text-amber-400 hover:text-amber-300 font-medium">Manage →</button>
              </div>
              <div className="space-y-1">
                {connections.map((c) => (
                  <div key={c.name} className="flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                    <div>
                      <p className="text-[13px] font-medium text-gray-200">{c.name}</p>
                      <p className="text-[11px] text-gray-500">{c.type}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        c.status === "connected"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        {c.status === "connected" ? "Connected" : "Pending"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
