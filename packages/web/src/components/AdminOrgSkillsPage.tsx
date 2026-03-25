"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, PageShell, SectionCard } from "./MiraShell";

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
    <PageShell
      title="Organization skills"
      subtitle="Control which marketplace skills every org member receives by default, and which are mandatory across the workspace."
      eyebrow="Admin workspace"
      actions={<button onClick={() => load()} className="mira-button-secondary px-4 py-2 text-xs font-semibold">Refresh</button>}
    >
      <div className="mx-auto max-w-5xl space-y-4">
        {message && <SectionCard><p className="text-sm text-slate-600">{message}</p></SectionCard>}

        {loading ? (
          <SectionCard><p className="text-sm text-slate-500">Loading skills…</p></SectionCard>
        ) : skills.length === 0 ? (
          <EmptyState icon="⬢" title="No marketplace skills found" description="Install or publish skills first, then assign them across the organization from here." />
        ) : (
          <div className="space-y-4">
            {skills.map((skill) => {
              const assignment = assignmentMap.get(skill.id);
              const isAssigned = !!assignment;
              const isRequired = !!assignment && assignment.required === 1;

              return (
                <SectionCard key={skill.id} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold tracking-[-0.03em] text-slate-950">{skill.name}</h3>
                      {isAssigned && (
                        <span className={`mira-pill ${isRequired ? "bg-rose-100 text-rose-700" : "bg-sky-100 text-sky-700"}`}>
                          {isRequired ? "Required" : "Optional"}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 font-mono text-xs text-slate-400">{skill.id}</p>
                    {skill.description && <p className="mt-2 text-sm leading-6 text-slate-600">{skill.description}</p>}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => assign(skill.id, false)} className="mira-button-secondary px-4 py-2 text-xs font-semibold">
                      Assign optional
                    </button>
                    <button onClick={() => assign(skill.id, true)} className="mira-button-secondary px-4 py-2 text-xs font-semibold">
                      Assign required
                    </button>
                    <button onClick={() => remove(skill.id)} disabled={!isAssigned} className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-600 disabled:opacity-40">
                      Remove
                    </button>
                  </div>
                </SectionCard>
              );
            })}
          </div>
        )}
      </div>
    </PageShell>
  );
}
