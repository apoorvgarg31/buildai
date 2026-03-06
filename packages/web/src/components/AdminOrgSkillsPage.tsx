"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type MarketplaceSkill = {
  id: string;
  name: string;
  description?: string;
  assignedByOrg?: boolean;
  requiredByOrg?: boolean;
};

type OrgAssignment = {
  org_id: string;
  skill_id: string;
  required: number;
  updated_at: string;
};

export default function AdminOrgSkillsPage() {
  const [skills, setSkills] = useState<MarketplaceSkill[]>([]);
  const [assignments, setAssignments] = useState<OrgAssignment[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [skillsRes, assignmentRes] = await Promise.all([
        fetch("/api/marketplace/skills"),
        fetch("/api/admin/org-skills"),
      ]);

      if (skillsRes.ok) {
        const data = await skillsRes.json();
        setSkills(Array.isArray(data.skills) ? data.skills : []);
      }

      if (assignmentRes.ok) {
        const data = await assignmentRes.json();
        setAssignments(Array.isArray(data.items) ? data.items : []);
        if (typeof data.orgId === "string") setOrgId(data.orgId);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const assignmentMap = useMemo(() => {
    const map = new Map<string, OrgAssignment>();
    assignments.forEach((a) => map.set(a.skill_id, a));
    return map;
  }, [assignments]);

  async function assign(skillId: string, required: boolean) {
    setMessage("");
    const res = await fetch("/api/admin/org-skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: orgId || undefined, skillId, required }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error || data.message || "Failed to assign skill");
      return;
    }
    setMessage(required ? "Assigned as required" : "Assigned as optional");
    await load();
  }

  async function remove(skillId: string) {
    setMessage("");
    const res = await fetch("/api/admin/org-skills", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: orgId || undefined, skillId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error || data.message || "Failed to remove assignment");
      return;
    }
    setMessage("Removed assignment");
    await load();
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="flex items-center justify-between pl-14 pr-6 lg:px-6 h-14 border-b border-black/5">
        <div>
          <h2 className="text-sm font-semibold text-[#171717]">Org Skills</h2>
          <p className="text-[11px] text-[#8e8e8e]">Assign marketplace skills for your organization</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-5xl mx-auto space-y-4">
          {message && <p className="text-xs text-[#666]">{message}</p>}
          {loading ? (
            <div className="text-sm text-[#8e8e8e]">Loading skills…</div>
          ) : (
            <div className="rounded-2xl border border-black/10 divide-y divide-black/5">
              {skills.map((skill) => {
                const assignment = assignmentMap.get(skill.id);
                const isAssigned = !!assignment;
                const isRequired = !!assignment && assignment.required === 1;

                return (
                  <div key={skill.id} className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#171717]">{skill.name}</p>
                      <p className="text-xs text-[#666]">{skill.id}</p>
                      {skill.description && <p className="text-xs text-[#8e8e8e] mt-1">{skill.description}</p>}
                      {isAssigned && (
                        <span className={`inline-flex mt-2 px-2 py-0.5 text-[10px] rounded-full ${isRequired ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                          {isRequired ? 'Required' : 'Optional'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => assign(skill.id, false)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-black/10"
                      >
                        Assign Optional
                      </button>
                      <button
                        onClick={() => assign(skill.id, true)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-black/10"
                      >
                        Assign Required
                      </button>
                      <button
                        onClick={() => remove(skill.id)}
                        disabled={!isAssigned}
                        className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-500 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}

              {skills.length === 0 && (
                <div className="p-4 text-sm text-[#8e8e8e]">No marketplace skills found.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
