"use client";

import { DemoUser } from "@/lib/auth";

interface AdminDashboardProps {
  user: DemoUser;
}

const stats = [
  { label: "Active Users", value: "24", icon: "👥", change: "+3 this week" },
  { label: "AI Agents", value: "24", icon: "🤖", change: "All healthy" },
  { label: "Connections", value: "6", icon: "🔗", change: "2 pending setup" },
  { label: "Queries Today", value: "1,847", icon: "💬", change: "+12% vs yesterday" },
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
  { name: "PostgreSQL (Projects DB)", type: "Database", status: "connected", users: 24 },
  { name: "Gemini 2.0 Flash", type: "LLM", status: "connected", users: 24 },
  { name: "Primavera P6", type: "Scheduling", status: "pending", users: 0 },
  { name: "Unifier", type: "Cost Management", status: "pending", users: 0 },
  { name: "SharePoint", type: "Documents", status: "connected", users: 18 },
];

export default function AdminDashboard({ user }: AdminDashboardProps) {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Admin Dashboard</h2>
          <p className="text-xs text-gray-500">Welcome back, {user.name}</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 px-4 sm:px-6 py-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <span className="text-2xl">{stat.icon}</span>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
                <p className="text-xs text-green-500 mt-1">{stat.change}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Users */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Users</h3>
                <button className="text-xs text-amber-500 hover:text-amber-400 font-medium">View all →</button>
              </div>
              <div className="space-y-3">
                {recentUsers.map((u) => (
                  <div key={u.name} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300">
                        {u.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{u.name}</p>
                        <p className="text-xs text-gray-500">{u.role} · {u.projects} projects</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${u.status === "active" ? "text-green-500" : "text-gray-400"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.status === "active" ? "bg-green-500" : "bg-gray-400"}`} />
                        {u.status}
                      </span>
                      <p className="text-xs text-gray-400 mt-0.5">{u.queries} queries</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Connections */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Connections</h3>
                <button className="text-xs text-amber-500 hover:text-amber-400 font-medium">Manage →</button>
              </div>
              <div className="space-y-3">
                {connections.map((c) => (
                  <div key={c.name} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.type}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.status === "connected"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }`}>
                        {c.status === "connected" ? "Connected" : "Pending"}
                      </span>
                      <p className="text-xs text-gray-400 mt-0.5">{c.users} users</p>
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
