"use client";

import { useState } from "react";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  assignedAgent: string;
  status: "active" | "inactive";
  lastActive: string;
  queries: number;
  avatar: string;
}

const demoUsers: UserRecord[] = [
  { id: "1", name: "Mike Torres", email: "mike.torres@hensel.com", role: "Senior PM", assignedAgent: "BuildAI Agent #1", status: "active", lastActive: "2 min ago", queries: 342, avatar: "MT" },
  { id: "2", name: "Lisa Park", email: "lisa.park@hensel.com", role: "Project Manager", assignedAgent: "BuildAI Agent #2", status: "active", lastActive: "15 min ago", queries: 189, avatar: "LP" },
  { id: "3", name: "James Wright", email: "james.wright@hensel.com", role: "Project Engineer", assignedAgent: "BuildAI Agent #1", status: "active", lastActive: "1 hour ago", queries: 267, avatar: "JW" },
  { id: "4", name: "Ana Rodriguez", email: "ana.rodriguez@hensel.com", role: "PM Director", assignedAgent: "BuildAI Agent #3", status: "active", lastActive: "30 min ago", queries: 503, avatar: "AR" },
  { id: "5", name: "David Kim", email: "david.kim@hensel.com", role: "Project Manager", assignedAgent: "BuildAI Agent #2", status: "inactive", lastActive: "3 days ago", queries: 42, avatar: "DK" },
  { id: "6", name: "Rachel Foster", email: "rachel.foster@hensel.com", role: "Cost Engineer", assignedAgent: "BuildAI Agent #4", status: "active", lastActive: "5 min ago", queries: 156, avatar: "RF" },
  { id: "7", name: "Carlos Mendez", email: "carlos.mendez@hensel.com", role: "Scheduler", assignedAgent: "BuildAI Agent #1", status: "active", lastActive: "45 min ago", queries: 98, avatar: "CM" },
  { id: "8", name: "Priya Sharma", email: "priya.sharma@hensel.com", role: "QA Manager", assignedAgent: "Unassigned", status: "inactive", lastActive: "1 week ago", queries: 7, avatar: "PS" },
];

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [showAddModal, setShowAddModal] = useState(false);

  const filtered = demoUsers.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "all" || u.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const activeCount = demoUsers.filter((u) => u.status === "active").length;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 h-14 border-b border-white/5">
        <div>
          <h2 className="text-sm font-semibold text-white">Users</h2>
          <p className="text-[11px] text-gray-500">{demoUsers.length} total · {activeCount} active</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[13px] font-semibold transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </button>
      </header>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-white/5 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#171717] border border-white/5 rounded-lg text-[13px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500/30 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 bg-[#171717] border border-white/5 rounded-lg p-0.5">
          {(["all", "active", "inactive"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors capitalize ${
                filterStatus === s
                  ? "bg-white/10 text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="rounded-xl border border-white/5 bg-[#171717] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Assigned Agent</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Last Active</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Queries</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0">
                        {u.avatar}
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-gray-200">{u.name}</p>
                        <p className="text-[11px] text-gray-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-400">{u.role}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[12px] font-medium ${u.assignedAgent === "Unassigned" ? "text-gray-600" : "text-gray-300"}`}>
                      {u.assignedAgent}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${
                      u.status === "active" ? "text-emerald-400" : "text-gray-500"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        u.status === "active" ? "bg-emerald-400" : "bg-gray-600"
                      }`} />
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-500">{u.lastActive}</td>
                  <td className="px-4 py-3 text-right text-[13px] font-medium text-gray-300">{u.queries.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="p-1.5 text-gray-600 hover:text-gray-300 rounded-md hover:bg-white/5 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 5v.01M12 12v.01M12 19v.01" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div className="w-full max-w-md bg-[#171717] border border-white/10 rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Add New User</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-gray-400 mb-1">Full Name</label>
                <input type="text" placeholder="John Doe" className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-[13px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500/30" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-400 mb-1">Email</label>
                <input type="email" placeholder="john@hensel.com" className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-[13px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500/30" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-400 mb-1">Role</label>
                <select className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-[13px] text-gray-200 focus:outline-none focus:border-amber-500/30">
                  <option>Project Manager</option>
                  <option>Senior PM</option>
                  <option>Project Engineer</option>
                  <option>Cost Engineer</option>
                  <option>Scheduler</option>
                  <option>QA Manager</option>
                  <option>PM Director</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-400 mb-1">Assign Agent</label>
                <select className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-[13px] text-gray-200 focus:outline-none focus:border-amber-500/30">
                  <option>BuildAI Agent #1</option>
                  <option>BuildAI Agent #2</option>
                  <option>BuildAI Agent #3</option>
                  <option>BuildAI Agent #4</option>
                  <option>Auto-assign</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-[13px] text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                Cancel
              </button>
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-[13px] font-semibold rounded-lg transition-colors">
                Add User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
