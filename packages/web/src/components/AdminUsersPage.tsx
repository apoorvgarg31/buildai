"use client";

import { useState, useEffect, useCallback } from "react";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  agent_id: string | null;
  created_at: string;
}

interface Agent {
  id: string;
  name: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("user");

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, agentsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/agents"),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (agentsRes.ok) setAgents(await agentsRes.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async () => {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formName, email: formEmail, role: formRole }),
    });
    if (res.ok) {
      setShowAddModal(false);
      setFormName(""); setFormEmail("");
      fetchData();
    }
  };

  const handleAssignAgent = async (userId: string, agentId: string | null) => {
    await fetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: agentId || null }),
    });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this user?")) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    fetchData();
  };

  const getAgentName = (agentId: string | null) =>
    agentId ? agents.find((a) => a.id === agentId)?.name || agentId : "Unassigned";

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="flex items-center justify-between pl-14 pr-6 lg:px-6 h-14 border-b border-black/5">
        <div>
          <h2 className="text-sm font-semibold text-[#171717]">Users</h2>
          <p className="text-[11px] text-[#8e8e8e]">
            {loading ? "Loading..." : `${users.length} user${users.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#171717] hover:bg-[#333] text-white text-[13px] font-semibold transition-colors">
          <span>+</span> Add User
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-[#8e8e8e] text-sm">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[#8e8e8e] text-sm">
            <p>No users yet</p>
            <button onClick={() => setShowAddModal(true)} className="mt-2 text-[#171717] hover:text-amber-300 text-sm">Add your first user</button>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="rounded-xl border border-black/5 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-black/5">
                    <th className="text-left px-5 py-3 text-[11px] font-medium text-[#8e8e8e] uppercase tracking-wider">User</th>
                    <th className="text-left px-5 py-3 text-[11px] font-medium text-[#8e8e8e] uppercase tracking-wider">Role</th>
                    <th className="text-left px-5 py-3 text-[11px] font-medium text-[#8e8e8e] uppercase tracking-wider">Assigned Agent</th>
                    <th className="text-right px-5 py-3 text-[11px] font-medium text-[#8e8e8e] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-black/5 hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center text-[11px] font-semibold text-amber-300">
                            {user.name.split(" ").map((n) => n[0]).join("").substring(0, 2)}
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-[#171717]">{user.name}</p>
                            <p className="text-[11px] text-[#8e8e8e]">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          user.role === "admin"
                            ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                            : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <select
                          value={user.agent_id || ""}
                          onChange={(e) => handleAssignAgent(user.id, e.target.value || null)}
                          className="bg-white border border-[#e5e5e5] rounded-lg px-2 py-1 text-[12px] text-[#333] focus:outline-none focus:border-[#171717]/20"
                        >
                          <option value="">Unassigned</option>
                          {agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>{agent.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => handleDelete(user.id)} className="text-[11px] text-red-400 hover:text-red-300 font-medium">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div className="w-full max-w-md bg-[#f9f9f9] border border-[#e5e5e5] rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[#171717] mb-4">Add User</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1">Name</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Jane Smith"
                  className="w-full px-3 py-2 bg-white border border-[#e5e5e5] rounded-lg text-[13px] text-[#171717] placeholder-[#b4b4b4] focus:outline-none focus:border-[#171717]/20" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1">Email</label>
                <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="jane@company.com"
                  className="w-full px-3 py-2 bg-white border border-[#e5e5e5] rounded-lg text-[13px] text-[#171717] placeholder-[#b4b4b4] focus:outline-none focus:border-[#171717]/20" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1">Role</label>
                <select value={formRole} onChange={(e) => setFormRole(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#e5e5e5] rounded-lg text-[13px] text-[#171717] focus:outline-none focus:border-[#171717]/20">
                  <option value="user">User (PM)</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-[13px] text-[#8e8e8e] hover:text-[#171717] transition-colors rounded-lg hover:bg-black/[0.04]">Cancel</button>
              <button onClick={handleAdd} disabled={!formName || !formEmail}
                className="px-4 py-2 bg-[#171717] hover:bg-[#333] text-white text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-50">
                Add User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
