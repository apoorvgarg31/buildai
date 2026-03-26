"use client";

import { useEffect, useState } from "react";
import { EmptyState, PageShell, SectionCard } from "./MiraShell";

interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  vendor: string;
  version: string;
  tags: string[];
  readme: string;
  installed?: boolean;
  installedByUser?: boolean;
  effectiveSource?: "user_installed_public" | "public";
  removableByUser?: boolean;
  installablePublic?: boolean;
  requiresConnections?: boolean;
  requiredConnectionTypes?: string[];
  requirementsSatisfied?: boolean;
  requirementStates?: Array<{
    type: string;
    authMode: 'shared' | 'oauth_user' | 'token_user';
    connectionName?: string;
    connectUrl?: string;
    ready: boolean;
    needsUserAuth: boolean;
    available: boolean;
  }>;
}

export default function MarketplacePage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [agentId, setAgentId] = useState<string | null>(null);
  const [busySkillId, setBusySkillId] = useState<string | null>(null);

  const refreshSkills = () => {
    const qs = agentId ? `?agentId=${encodeURIComponent(agentId)}` : "";
    fetch(`/api/marketplace/skills${qs}`)
      .then((r) => r.json())
      .then((data) => {
        setSkills(data.skills || []);
        setCategories(data.categories || []);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((me) => {
        const aid = me?.agentId || null;
        setAgentId(aid);
      })
      .catch(() => setAgentId(null));
  }, []);

  useEffect(() => {
    refreshSkills();
  }, [agentId]);

  const filtered = skills.filter((s) => {
    const matchesCategory = activeCategory === "All" || s.category === activeCategory;
    const matchesSearch =
      !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const copyInstallUrl = (skill: Skill) => {
    const url = `${window.location.origin}/api/marketplace/skills/${skill.id}/install`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(skill.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const installSkill = async (skill: Skill) => {
    if (!agentId) return;
    setBusySkillId(skill.id);
    try {
      const res = await fetch(`/api/marketplace/skills/${skill.id}/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      if (!res.ok) throw new Error("Install failed");
      refreshSkills();
    } catch (e) {
      console.error(e);
    } finally {
      setBusySkillId(null);
    }
  };

  const uninstallSkill = async (skill: Skill) => {
    if (!agentId) return;
    setBusySkillId(skill.id);
    try {
      const res = await fetch(`/api/marketplace/skills/${skill.id}?agentId=${encodeURIComponent(agentId)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Remove failed");
      refreshSkills();
    } catch (e) {
      console.error(e);
    } finally {
      setBusySkillId(null);
    }
  };

  return (
    <PageShell
      title="Marketplace"
      subtitle="Browse public and user-installed skills in the same premium Mira system."
      eyebrow="Skill marketplace"
      actions={<button onClick={refreshSkills} className="mira-button-secondary px-4 py-2 text-xs font-semibold">Refresh</button>}
    >
      <div className="mx-auto max-w-6xl space-y-5">
        <SectionCard>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <input
              type="text"
              placeholder="Search skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mira-input max-w-xl px-4 py-3 text-sm"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveCategory("All")}
                className={`rounded-full px-4 py-2 text-xs font-semibold ${activeCategory === "All" ? "bg-slate-950 text-white" : "bg-white text-slate-600 border border-slate-200"}`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${activeCategory === cat ? "bg-slate-950 text-white" : "bg-white text-slate-600 border border-slate-200"}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </SectionCard>

        {filtered.length === 0 ? (
          <EmptyState icon="◇" title="No skills match this view" description="Try a different category or search term to surface relevant skills." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((skill) => (
              <SectionCard key={skill.id} className="cursor-pointer transition hover:-translate-y-0.5">
                <div onClick={() => setSelectedSkill(skill)} className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="mira-icon-chip text-xl">{skill.icon}</div>
                      <div>
                        <h3 className="text-base font-semibold tracking-[-0.03em] text-slate-950">{skill.name}</h3>
                        <p className="mt-1 text-xs text-slate-500">{skill.vendor} · v{skill.version}</p>
                      </div>
                    </div>
                    {skill.version === "0.1.0" && <span className="mira-pill bg-slate-100 text-slate-600">Coming soon</span>}
                  </div>

                  <p className="line-clamp-3 text-sm leading-6 text-slate-600">{skill.description}</p>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mira-pill bg-slate-100 text-slate-600">{skill.category}</span>
                    {skill.installedByUser && <span className="mira-pill bg-emerald-100 text-emerald-700">Installed by you</span>}
                    {skill.requiresConnections && !skill.requirementsSatisfied && <span className="mira-pill bg-amber-100 text-amber-700">Needs connector</span>}
                  </div>

                  {skill.requiresConnections && (
                    <div className="space-y-2">
                      {skill.requirementStates?.map((state) => (
                        <div key={`${skill.id}-${state.type}`} className="rounded-2xl border border-slate-200/70 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          <span className="font-semibold text-slate-800">{state.type}</span>
                          {state.ready ? ' ready' : state.available ? state.needsUserAuth ? ' needs your sign-in' : ' unavailable' : ' not configured by admin'}
                        </div>
                      ))}
                    </div>
                  )}

                  {skill.version !== "0.1.0" && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {skill.installablePublic && !skill.installedByUser && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            installSkill(skill);
                          }}
                          disabled={busySkillId === skill.id || !agentId}
                          className="mira-button-primary px-4 py-2 text-xs font-semibold disabled:opacity-50"
                        >
                          {busySkillId === skill.id ? "Installing…" : "Install"}
                        </button>
                      )}
                      {skill.removableByUser && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            uninstallSkill(skill);
                          }}
                          disabled={busySkillId === skill.id}
                          className="mira-button-secondary px-4 py-2 text-xs font-semibold disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyInstallUrl(skill);
                        }}
                        className="mira-button-secondary px-4 py-2 text-xs font-semibold"
                      >
                        {copiedId === skill.id ? "Copied" : "Copy URL"}
                      </button>
                    </div>
                  )}
                </div>
              </SectionCard>
            ))}
          </div>
        )}
      </div>

      {selectedSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm" onClick={() => setSelectedSkill(null)}>
          <div className="mira-surface flex max-h-[82vh] w-full max-w-2xl flex-col rounded-[1.8rem]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-slate-200/60 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="mira-icon-chip text-xl">{selectedSkill.icon}</div>
                <div>
                  <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">{selectedSkill.name}</h2>
                  <p className="mt-1 text-xs text-slate-500">{selectedSkill.vendor} · v{selectedSkill.version} · {selectedSkill.category}</p>
                </div>
              </div>
              <button onClick={() => setSelectedSkill(null)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">Close</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="text-sm leading-6 text-slate-600">{selectedSkill.description}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {selectedSkill.tags.map((tag) => (
                  <span key={tag} className="mira-pill bg-slate-100 text-slate-600">{tag}</span>
                ))}
              </div>

              {selectedSkill.version !== "0.1.0" && (
                <div className="mira-surface-muted mt-5 rounded-[1.2rem] p-4">
                  <h3 className="text-sm font-semibold text-slate-950">Install flow</h3>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
                    <li>Copy the install URL.</li>
                    <li>Paste it into your assistant chat.</li>
                    <li>Ask Mira to install the skill.</li>
                  </ol>
                  {selectedSkill.requiresConnections && selectedSkill.requirementStates?.length ? (
                    <div className="mt-4 space-y-2 border-t border-slate-200/70 pt-4 text-sm text-slate-600">
                      <p className="font-semibold text-slate-900">Required connectors</p>
                      {selectedSkill.requirementStates.map((state) => (
                        <div key={`${selectedSkill.id}-modal-${state.type}`} className="rounded-2xl bg-white px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <span>{state.type}</span>
                            <span className={`mira-pill ${state.ready ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {state.ready ? 'Ready' : state.available ? state.needsUserAuth ? 'Sign in needed' : 'Blocked' : 'Admin setup needed'}
                            </span>
                          </div>
                          {state.connectUrl && state.needsUserAuth ? (
                            <a href={state.connectUrl} className="mt-2 inline-flex text-xs font-semibold text-blue-700 underline-offset-2 hover:underline">
                              Connect now
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              <div className="mt-5 whitespace-pre-line text-sm leading-6 text-slate-600">
                {selectedSkill.readme}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200/60 px-6 py-4">
              <button onClick={() => setSelectedSkill(null)} className="mira-button-secondary px-4 py-2 text-sm font-semibold">Close</button>
              {selectedSkill.version !== "0.1.0" && (
                <button onClick={() => copyInstallUrl(selectedSkill)} className="mira-button-primary px-4 py-2 text-sm font-semibold">
                  {copiedId === selectedSkill.id ? "Copied" : "Copy install URL"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
