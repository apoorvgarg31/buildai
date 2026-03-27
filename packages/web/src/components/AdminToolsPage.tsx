"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, PageShell, SectionCard } from "./MiraShell";

interface ToolPolicy {
  name: string;
  label: string;
  description: string;
  category: string;
  risk: 'standard' | 'sensitive' | 'power';
  enabled: boolean;
  defaultEnabled: boolean;
}

interface AdminToolsPageProps {
  initialTools?: ToolPolicy[];
}

const riskStyles: Record<ToolPolicy['risk'], string> = {
  standard: 'bg-emerald-100 text-emerald-700',
  sensitive: 'bg-amber-100 text-amber-700',
  power: 'bg-rose-100 text-rose-700',
};

export default function AdminToolsPage({ initialTools }: AdminToolsPageProps) {
  const [tools, setTools] = useState<ToolPolicy[]>(initialTools || []);
  const [loading, setLoading] = useState(!initialTools);
  const [savingName, setSavingName] = useState<string | null>(null);

  const fetchTools = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/tools');
      if (res.ok) {
        setTools(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialTools) return;
    fetchTools();
  }, [fetchTools, initialTools]);

  const grouped = useMemo(() => {
    return tools.reduce<Record<string, ToolPolicy[]>>((acc, tool) => {
      acc[tool.category] = acc[tool.category] || [];
      acc[tool.category].push(tool);
      return acc;
    }, {});
  }, [tools]);

  const updateTool = async (toolName: string, enabled: boolean) => {
    setSavingName(toolName);
    try {
      const res = await fetch(`/api/admin/tools/${toolName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        setTools((current) => current.map((tool) => (tool.name === toolName ? { ...tool, enabled } : tool)));
      }
    } finally {
      setSavingName(null);
    }
  };

  return (
    <PageShell
      title="Tools"
      subtitle="Choose which OpenClaw tools every Mira agent inherits by default. This is the global runtime policy before any skill-specific gating."
      eyebrow="Admin workspace"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <SectionCard>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400">Inheritance</p>
              <p className="mt-2 text-sm text-slate-700">Inherited by every agent unless the policy changes.</p>
            </div>
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400">Default posture</p>
              <p className="mt-2 text-sm text-slate-700">Keep research and coordination on. Gate interactive and platform control carefully.</p>
            </div>
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400">Runtime intent</p>
              <p className="mt-2 text-sm text-slate-700">Connectors stay user-facing. Tools stay admin-facing.</p>
            </div>
          </div>
        </SectionCard>

        {loading ? (
          <SectionCard><p className="text-sm text-slate-500">Loading tool policy…</p></SectionCard>
        ) : tools.length === 0 ? (
          <EmptyState icon="⚙" title="No tools discovered" description="Tool policy will appear here once the OpenClaw catalog is loaded." hint="Runtime policy" />
        ) : (
          Object.entries(grouped).map(([category, entries]) => (
            <SectionCard key={category} className="space-y-4">
              <div>
                <p className="mira-eyebrow">{category}</p>
                <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">{category} tools</h2>
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {entries.map((tool) => (
                  <div key={tool.name} className="mira-surface-muted rounded-[1.2rem] px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-950">{tool.label}</h3>
                          <span className={`mira-pill ${riskStyles[tool.risk]}`}>{tool.risk}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{tool.description}</p>
                        <p className="mt-3 font-mono text-xs text-slate-400">{tool.name}</p>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                          aria-label={`Enable ${tool.label}`}
                          type="checkbox"
                          checked={tool.enabled}
                          disabled={savingName === tool.name}
                          onChange={(e) => updateTool(tool.name, e.target.checked)}
                        />
                        <span>{tool.enabled ? 'On' : 'Off'}</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          ))
        )}
      </div>
    </PageShell>
  );
}
