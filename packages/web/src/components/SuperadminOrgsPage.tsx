"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, PageShell, SectionCard } from "./MiraShell";

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

  const currentEditingOrg = useMemo(() => orgs.find((o) => o.id === editingOrgId) || null, [editingOrgId, orgs]);

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

  const deleteOrg = useCallback(async (orgId: string, orgName: string) => {
    if (!confirm(`Delete organization "${orgName}"? This removes memberships and org-linked records.`)) return;
    setError("");
    try {
      const res = await fetch(`/api/superadmin/orgs/${encodeURIComponent(orgId)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Failed to delete org");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete org");
    }
  }, [load]);

  const assignMember = useCallback(async (orgId: string) => {
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
  }, [load, loadMembers, memberDraft]);

  const toggleMembers = useCallback(async (orgId: string) => {
    const next = expandedOrgId === orgId ? null : orgId;
    setExpandedOrgId(next);
    if (next && !membersByOrg[next]) await loadMembers(next);
  }, [expandedOrgId, membersByOrg, loadMembers]);

  return (
    <PageShell title="Organizations" subtitle="Superadmin control over tenancy, membership, and org-level operating structure in the Mira system." eyebrow="Superadmin workspace">
      <div className="mx-auto max-w-6xl space-y-5">
        <SectionCard>
          <p className="mira-eyebrow">Create organization</p>
          <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">Add a new tenant</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Organization name" className="mira-input px-4 py-3 text-sm" />
            <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug (optional)" className="mira-input px-4 py-3 text-sm" />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={createOrg} disabled={!name.trim()} className="mira-button-primary px-4 py-2 text-sm font-semibold disabled:opacity-50">Create org</button>
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>
        </SectionCard>

        {loading ? (
          <SectionCard><p className="text-sm text-slate-500">Loading organizations…</p></SectionCard>
        ) : orgs.length === 0 ? (
          <EmptyState icon="◫" title="No organizations yet" description="Create the first tenant to start segmenting users, agents, and skills across customers or business units." />
        ) : (
          <div className="space-y-4">
            {orgs.map((org) => (
              <SectionCard key={org.id} className="space-y-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">{org.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{org.slug} • {new Date(org.created_at).toLocaleString()}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-400">{org.members_count ?? 0} members • {org.admins_count ?? 0} admins • {org.agents_count ?? 0} agents</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => { setEditingOrgId(org.id); setEditName(org.name); setEditSlug(org.slug); }} className="mira-button-secondary px-4 py-2 text-xs font-semibold">Edit</button>
                    <button onClick={() => void toggleMembers(org.id)} className="mira-button-secondary px-4 py-2 text-xs font-semibold">{expandedOrgId === org.id ? "Hide members" : "Members"}</button>
                    <button onClick={() => void deleteOrg(org.id, org.name)} className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-600">Delete</button>
                  </div>
                </div>

                {expandedOrgId === org.id && (
                  <div className="space-y-4 border-t border-slate-200/60 pt-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr),180px,auto]">
                      <input
                        value={memberDraft[org.id]?.userId || ""}
                        onChange={(e) => setMemberDraft((prev) => ({ ...prev, [org.id]: { userId: e.target.value, role: prev[org.id]?.role || "member" } }))}
                        placeholder="User ID to assign"
                        className="mira-input px-4 py-3 text-sm"
                      />
                      <select
                        value={memberDraft[org.id]?.role || "member"}
                        onChange={(e) => setMemberDraft((prev) => ({ ...prev, [org.id]: { userId: prev[org.id]?.userId || "", role: e.target.value === "admin" ? "admin" : "member" } }))}
                        className="mira-select px-4 py-3 text-sm"
                      >
                        <option value="admin">admin</option>
                        <option value="member">member</option>
                      </select>
                      <button onClick={() => void assignMember(org.id)} className="mira-button-primary px-4 py-2 text-sm font-semibold">Assign member</button>
                    </div>

                    <div className="space-y-2">
                      {(membersByOrg[org.id] || []).length === 0 ? (
                        <p className="text-sm text-slate-500">No members yet.</p>
                      ) : (
                        (membersByOrg[org.id] || []).map((member) => (
                          <div key={`${member.organization_id}:${member.user_id}`} className="mira-surface-muted flex items-center justify-between gap-3 rounded-[1.1rem] px-4 py-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-950">{member.name || member.email || member.user_id}</p>
                              <p className="text-xs text-slate-500">{member.user_id}</p>
                            </div>
                            <span className={`mira-pill ${member.role === "admin" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"}`}>{member.role}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </SectionCard>
            ))}
          </div>
        )}
      </div>

      {editingOrgId && currentEditingOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-sm" onClick={() => setEditingOrgId(null)}>
          <div className="mira-surface w-full max-w-xl rounded-[1.8rem] p-6" onClick={(e) => e.stopPropagation()}>
            <p className="mira-eyebrow">Edit organization</p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-950">Update org details</h3>
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Name</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="mira-input px-4 py-3 text-sm" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Slug</label>
                <input type="text" value={editSlug} onChange={(e) => setEditSlug(e.target.value)} className="mira-input px-4 py-3 text-sm" />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => setEditingOrgId(null)} className="mira-button-secondary px-4 py-2 text-sm font-semibold">Cancel</button>
              <button onClick={() => void saveOrg()} className="mira-button-primary px-4 py-2 text-sm font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
