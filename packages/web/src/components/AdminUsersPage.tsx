"use client";

import { useState, useEffect, useCallback } from "react";
import { EmptyState, PageShell, SectionCard } from "./MiraShell";

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

interface Me {
  role: "admin" | "user";
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("user");
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [meRes, usersRes, agentsRes] = await Promise.all([
        fetch("/api/me"),
        fetch("/api/admin/users"),
        fetch("/api/admin/agents"),
      ]);

      let meData: Me | null = null;
      if (meRes.ok) {
        meData = await meRes.json();
        setMe(meData);
      }

      if (usersRes.ok) setUsers(await usersRes.json());
      if (agentsRes.ok) setAgents(await agentsRes.json());
    } catch {
      setError("We could not load admin users right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = async () => {
    setError(null);

    const payload: Record<string, unknown> = {
      name: formName,
      email: formEmail,
      role: formRole,
    };

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "We could not create that user.");
      return;
    }

    setShowAddModal(false);
    setFormName("");
    setFormEmail("");
    setFormRole("user");
    await fetchData();
  };

  const handleAssignAgent = async (userId: string, agentId: string | null) => {
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: agentId || null }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "We could not update that user.");
      return;
    }

    await fetchData();
  };

  const handleRoleChange = async (userId: string, role: string) => {
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "We could not update that user role.");
      await fetchData();
      return;
    }

    await fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this user?")) return;
    setError(null);
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "We could not delete that user.");
      return;
    }

    await fetchData();
  };

  return (
    <PageShell
      title="Users"
      subtitle="Invite teammates, shape access, and route each person to the right Mira agent without the usual admin clutter."
      eyebrow="Admin workspace"
      actions={
        <button onClick={() => setShowAddModal(true)} className="mira-button-primary px-4 py-2 text-xs font-semibold">
          Add user
        </button>
      }
    >
      <div className="mx-auto max-w-6xl space-y-4">
        {error ? (
          <SectionCard className="border-rose-200 bg-rose-50/70">
            <p className="text-sm text-rose-700">{error}</p>
          </SectionCard>
        ) : null}

        {loading ? (
          <SectionCard>
            <p className="text-sm text-slate-500">Loading users...</p>
          </SectionCard>
        ) : users.length === 0 ? (
          <EmptyState
            icon="◌"
            title="No users yet"
            description="Create your first Mira user to start assigning roles and dedicated agents."
            hint="Invite from admin"
          />
        ) : (
          <SectionCard className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200/60 text-left">
                <thead className="bg-white/55">
                  <tr>
                    <th className="px-5 py-4 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">User</th>
                    <th className="px-5 py-4 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">Role</th>
                    <th className="px-5 py-4 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">Assigned agent</th>
                    <th className="px-5 py-4 text-right text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id} className="bg-white/30 transition hover:bg-white/60">
                      <td className="px-5 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="mira-icon-chip h-11 w-11 shrink-0 text-xs font-semibold text-slate-700">
                            {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">{user.name}</p>
                            <p className="truncate text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <label className="sr-only" htmlFor={`role-${user.id}`}>Role for {user.name}</label>
                        <select
                          id={`role-${user.id}`}
                          aria-label={`Role for ${user.name}`}
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className="mira-select px-3 py-2 text-sm"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <select
                          aria-label={`Agent for ${user.name}`}
                          value={user.agent_id || ""}
                          onChange={(e) => handleAssignAgent(user.id, e.target.value || null)}
                          className="mira-select px-3 py-2 text-sm"
                        >
                          <option value="">Unassigned</option>
                          {agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>{agent.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-4 text-right align-middle">
                        <button onClick={() => handleDelete(user.id)} className="rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div className="mira-surface w-full max-w-xl rounded-[1.8rem] p-6" onClick={(e) => e.stopPropagation()}>
            <p className="mira-eyebrow">Invite user</p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-950">Add a teammate</h3>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Name</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Jane Smith" className="mira-input px-4 py-3 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Email</label>
                <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="jane@company.com" className="mira-input px-4 py-3 text-sm" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Platform role</label>
                <select value={formRole} onChange={(e) => setFormRole(e.target.value)} className="mira-select px-4 py-3 text-sm">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="mira-button-secondary px-4 py-2 text-sm font-semibold">Cancel</button>
              <button onClick={handleAdd} disabled={!formName || !formEmail} className="mira-button-primary px-4 py-2 text-sm font-semibold disabled:opacity-50">
                Add user
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
