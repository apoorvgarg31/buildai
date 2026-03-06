"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface Org {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  members_count?: number;
  admins_count?: number;
  agents_count?: number;
}

interface Member {
  organization_id: string;
  user_id: string;
  role: "admin" | "member";
  email?: string;
  name?: string;
}

interface MemberDraft {
  [orgId: string]: { userId: string; role: "admin" | "member" };
}

export default function SuperadminOrgsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [memberDraft, setMemberDraft] = useState<MemberDraft>({});
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null);
  const [membersByOrg, setMembersByOrg] = useState<Record<string, Member[]>>({});
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");

  const currentEditingOrg = useMemo(
    () => orgs.find((o) => o.id === editingOrgId) || null,
    [editingOrgId, orgs]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/superadmin/orgs");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Failed to load orgs");
      setOrgs(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load orgs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadMembers = useCallback(async (orgId: string) => {
    try {
      const res = await fetch(`/api/superadmin/orgs/${encodeURIComponent(orgId)}/members`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Failed to load members");
      setMembersByOrg((prev) => ({ ...prev, [orgId]: Array.isArray(data) ? data : [] }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load members");
    }
  }, []);

  const createOrg = useCallback(async () => {
    if (!name.trim()) return;
    setError("");
    try {
      const res = await fetch("/api/superadmin/orgs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
        body: JSON.stringify({ name, slug: slug || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Failed to create org");
      setName("");
      setSlug("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create org");
    }
  }, [name, slug, load]);

  const saveOrg = useCallback(async () => {
    if (!currentEditingOrg) return;
    setError("");
    try {
      const res = await fetch(`/api/superadmin/orgs/${encodeURIComponent(currentEditingOrg.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, slug: editSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Failed to update org");
      setEditingOrgId(null);
      setEditName("");
      setEditSlug("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update org");
    }
  }, [currentEditingOrg, editName, editSlug, load]);

  const deleteOrg = useCallback(
    async (orgId: string, orgName: string) => {
      if (!confirm(`Delete organization "${orgName}"? This removes memberships and org-linked records.`)) return;
      setError("");
      try {
        const res = await fetch(`/api/superadmin/orgs/${encodeURIComponent(orgId)}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || data?.error || "Failed to delete org");
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete org");
      }
    },
    [load]
  );

  const assignMember = useCallback(
    async (orgId: string) => {
      const draft = memberDraft[orgId];
      if (!draft?.userId?.trim()) return;
      setError("");
      try {
        const res = await fetch(`/api/superadmin/orgs/${encodeURIComponent(orgId)}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: draft.userId.trim(), role: draft.role || "member" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || data?.error || "Failed to assign member");
        setMemberDraft((prev) => ({ ...prev, [orgId]: { userId: "", role: "member" } }));
        await loadMembers(orgId);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to assign member");
      }
    },
    [load, loadMembers, memberDraft]
  );

  const toggleMembers = useCallback(
    async (orgId: string) => {
      const next = expandedOrgId === orgId ? null : orgId;
      setExpandedOrgId(next);
      if (next && !membersByOrg[next]) {
        await loadMembers(next);
      }
    },
    [expandedOrgId, membersByOrg, loadMembers]
  );

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="flex items-center justify-between pl-14 pr-6 lg:px-6 h-14 border-b border-black/5">
        <h1 className="text-sm font-semibold text-[#171717]">Organizations</h1>
      </header>

      <div className="p-6 space-y-4 overflow-y-auto">
        <div className="max-w-2xl rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-4 space-y-3">
          <p className="text-sm font-medium text-[#171717]">Create organization</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Organization name"
              className="px-3 py-2 rounded-lg border border-[#e5e5e5] text-sm"
            />
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="slug (optional)"
              className="px-3 py-2 rounded-lg border border-[#e5e5e5] text-sm"
            />
          </div>
          <button
            onClick={createOrg}
            disabled={!name.trim()}
            className="px-3 py-2 rounded-lg bg-[#171717] text-white text-sm disabled:opacity-50"
          >
            Create org
          </button>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="max-w-5xl">
          <p className="text-xs text-[#8e8e8e] mb-2">All organizations (CRUD)</p>
          {loading ? (
            <p className="text-sm text-[#8e8e8e]">Loading...</p>
          ) : orgs.length === 0 ? (
            <p className="text-sm text-[#8e8e8e]">No organizations yet.</p>
          ) : (
            <div className="space-y-2">
              {orgs.map((o) => (
                <div key={o.id} className="border border-[#e5e5e5] rounded-xl px-4 py-3 bg-white space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-[#171717]">{o.name}</p>
                      <p className="text-xs text-[#8e8e8e]">{o.slug} • {new Date(o.created_at).toLocaleString()}</p>
                      <p className="text-xs text-[#8e8e8e] mt-1">
                        {o.members_count ?? 0} members • {o.admins_count ?? 0} admins • {o.agents_count ?? 0} agents
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingOrgId(o.id);
                          setEditName(o.name);
                          setEditSlug(o.slug);
                        }}
                        className="px-2.5 py-1.5 rounded-md border border-[#d9d9d9] text-xs hover:border-[#b4b4b4]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void toggleMembers(o.id)}
                        className="px-2.5 py-1.5 rounded-md border border-[#d9d9d9] text-xs hover:border-[#b4b4b4]"
                      >
                        {expandedOrgId === o.id ? "Hide members" : "Members"}
                      </button>
                      <button
                        onClick={() => void deleteOrg(o.id, o.name)}
                        className="px-2.5 py-1.5 rounded-md border border-red-200 text-red-600 text-xs hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {expandedOrgId === o.id && (
                    <div className="pt-2 border-t border-[#f0f0f0] space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={memberDraft[o.id]?.userId || ""}
                          onChange={(e) =>
                            setMemberDraft((prev) => ({
                              ...prev,
                              [o.id]: { userId: e.target.value, role: prev[o.id]?.role || "member" },
                            }))
                          }
                          placeholder="User ID to assign"
                          className="px-2.5 py-1.5 rounded-md border border-[#e5e5e5] text-xs min-w-[220px]"
                        />
                        <select
                          value={memberDraft[o.id]?.role || "member"}
                          onChange={(e) =>
                            setMemberDraft((prev) => ({
                              ...prev,
                              [o.id]: {
                                userId: prev[o.id]?.userId || "",
                                role: e.target.value === "admin" ? "admin" : "member",
                              },
                            }))
                          }
                          className="px-2.5 py-1.5 rounded-md border border-[#e5e5e5] text-xs"
                        >
                          <option value="admin">admin</option>
                          <option value="member">member</option>
                        </select>
                        <button
                          onClick={() => void assignMember(o.id)}
                          className="px-2.5 py-1.5 rounded-md border border-[#d9d9d9] text-xs hover:border-[#b4b4b4]"
                        >
                          Assign member
                        </button>
                      </div>

                      <div className="space-y-1">
                        {(membersByOrg[o.id] || []).length === 0 ? (
                          <p className="text-xs text-[#8e8e8e]">No members yet.</p>
                        ) : (
                          membersByOrg[o.id].map((m) => (
                            <p key={`${m.organization_id}:${m.user_id}`} className="text-xs text-[#4f4f4f]">
                              {m.name || m.email || m.user_id} — <span className="font-medium">{m.role}</span>
                            </p>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editingOrgId && currentEditingOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditingOrgId(null)}>
          <div className="w-full max-w-md bg-[#f9f9f9] border border-[#e5e5e5] rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[#171717] mb-4">Edit organization</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#e5e5e5] rounded-lg text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1">Slug</label>
                <input
                  type="text"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#e5e5e5] rounded-lg text-[13px]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditingOrgId(null)} className="px-4 py-2 text-[13px] text-[#8e8e8e] hover:text-[#171717]">Cancel</button>
              <button onClick={() => void saveOrg()} className="px-4 py-2 bg-[#171717] text-white text-[13px] font-semibold rounded-lg">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
