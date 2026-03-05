"use client";

import { useCallback, useEffect, useState } from "react";

interface Org {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

interface MemberDraft {
  [orgId: string]: { userId: string; role: 'owner' | 'admin' | 'member' };
}

export default function SuperadminOrgsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [memberDraft, setMemberDraft] = useState<MemberDraft>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch('/api/superadmin/orgs');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to load orgs');
      setOrgs(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orgs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createOrg = useCallback(async () => {
    if (!name.trim()) return;
    setError("");
    try {
      const res = await fetch('/api/superadmin/orgs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
        body: JSON.stringify({ name, slug: slug || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to create org');
      setName('');
      setSlug('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create org');
    }
  }, [name, slug, load]);

  const assignMember = useCallback(async (orgId: string) => {
    const draft = memberDraft[orgId];
    if (!draft?.userId?.trim()) return;
    setError('');
    try {
      const res = await fetch(`/api/superadmin/orgs/${encodeURIComponent(orgId)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: draft.userId.trim(), role: draft.role || 'admin' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to assign member');
      setMemberDraft((prev) => ({ ...prev, [orgId]: { userId: '', role: 'admin' } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to assign member');
    }
  }, [memberDraft]);

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="flex items-center justify-between pl-14 pr-6 lg:px-6 h-14 border-b border-black/5">
        <h1 className="text-sm font-semibold text-[#171717]">Organizations</h1>
      </header>

      <div className="p-6 space-y-4 overflow-y-auto">
        <div className="max-w-2xl rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-4 space-y-3">
          <p className="text-sm font-medium text-[#171717]">Create organization</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Organization name"
              className="px-3 py-2 rounded-lg border border-[#e5e5e5] text-sm" />
            <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug (optional)"
              className="px-3 py-2 rounded-lg border border-[#e5e5e5] text-sm" />
          </div>
          <button onClick={createOrg} disabled={!name.trim()} className="px-3 py-2 rounded-lg bg-[#171717] text-white text-sm disabled:opacity-50">
            Create org
          </button>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="max-w-4xl">
          <p className="text-xs text-[#8e8e8e] mb-2">All organizations</p>
          {loading ? (
            <p className="text-sm text-[#8e8e8e]">Loading...</p>
          ) : orgs.length === 0 ? (
            <p className="text-sm text-[#8e8e8e]">No organizations yet.</p>
          ) : (
            <div className="space-y-2">
              {orgs.map((o) => (
                <div key={o.id} className="border border-[#e5e5e5] rounded-xl px-4 py-3 bg-white space-y-2">
                  <p className="text-sm font-medium text-[#171717]">{o.name}</p>
                  <p className="text-xs text-[#8e8e8e]">{o.slug} • {new Date(o.created_at).toLocaleString()}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={memberDraft[o.id]?.userId || ''}
                      onChange={(e) => setMemberDraft((prev) => ({
                        ...prev,
                        [o.id]: { userId: e.target.value, role: prev[o.id]?.role || 'admin' },
                      }))}
                      placeholder="User ID to assign"
                      className="px-2.5 py-1.5 rounded-md border border-[#e5e5e5] text-xs min-w-[220px]"
                    />
                    <select
                      value={memberDraft[o.id]?.role || 'admin'}
                      onChange={(e) => setMemberDraft((prev) => ({
                        ...prev,
                        [o.id]: { userId: prev[o.id]?.userId || '', role: (e.target.value as 'owner' | 'admin' | 'member') },
                      }))}
                      className="px-2.5 py-1.5 rounded-md border border-[#e5e5e5] text-xs"
                    >
                      <option value="owner">owner</option>
                      <option value="admin">admin</option>
                      <option value="member">member</option>
                    </select>
                    <button
                      onClick={() => assignMember(o.id)}
                      className="px-2.5 py-1.5 rounded-md border border-[#d9d9d9] text-xs hover:border-[#b4b4b4]"
                    >
                      Assign member
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
