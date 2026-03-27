"use client";

import { useEffect, useState } from "react";
import { PageShell, SectionCard } from "./MiraShell";

interface AdminSettingsPageProps {
  initialSettings?: {
    companyName: string;
    defaultModel: string;
    responseStyle: string;
    maxQueriesPerDay: number;
    maxAgents: number;
    dataRetentionDays: number;
    hasSharedApiKey: boolean;
  };
}

export default function AdminSettingsPage({ initialSettings }: AdminSettingsPageProps) {
  const [companyName, setCompanyName] = useState("Mira");
  const [defaultModel, setDefaultModel] = useState("google/gemini-2.0-flash");
  const [responseStyle, setResponseStyle] = useState("professional");
  const [sharedApiKey, setSharedApiKey] = useState("");
  const [hasSharedApiKey, setHasSharedApiKey] = useState(false);
  const [maxQueriesPerDay, setMaxQueriesPerDay] = useState("500");
  const [maxAgents, setMaxAgents] = useState("10");
  const [dataRetention, setDataRetention] = useState("90");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSettings) {
      setCompanyName(initialSettings.companyName || "Mira");
      setDefaultModel(initialSettings.defaultModel || "google/gemini-2.0-flash");
      setResponseStyle(initialSettings.responseStyle || "professional");
      setMaxQueriesPerDay(String(initialSettings.maxQueriesPerDay || 500));
      setMaxAgents(String(initialSettings.maxAgents || 10));
      setDataRetention(String(initialSettings.dataRetentionDays || 90));
      setHasSharedApiKey(!!initialSettings.hasSharedApiKey);
      setLoading(false);
      return;
    }

    fetch("/api/admin/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setCompanyName(data.companyName || "Mira");
        setDefaultModel(data.defaultModel || "google/gemini-2.0-flash");
        setResponseStyle(data.responseStyle || "professional");
        setMaxQueriesPerDay(String(data.maxQueriesPerDay || 500));
        setMaxAgents(String(data.maxAgents || 10));
        setDataRetention(String(data.dataRetentionDays || 90));
        setHasSharedApiKey(!!data.hasSharedApiKey);
      })
      .catch(() => setError("We could not load admin settings."))
      .finally(() => setLoading(false));
  }, [initialSettings]);

  const handleSave = async () => {
    setError(null);
    const response = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName,
        defaultModel,
        responseStyle,
        maxQueriesPerDay: Number(maxQueriesPerDay),
        maxAgents: Number(maxAgents),
        dataRetentionDays: Number(dataRetention),
        sharedApiKey: sharedApiKey || undefined,
      }),
    });

    if (!response.ok) {
      setError("We could not save admin settings.");
      return;
    }

    const data = await response.json();
    setHasSharedApiKey(!!data.hasSharedApiKey || sharedApiKey.length > 0);
    setSharedApiKey("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <PageShell
      title="Admin settings"
      subtitle="Control company identity, model defaults, limits, and safety rails in the same Mira visual system."
      eyebrow="Admin workspace"
      actions={
        <button onClick={handleSave} className={`${saved ? "bg-emerald-600 text-white" : "mira-button-primary"} rounded-full px-4 py-2 text-xs font-semibold`}>
          {saved ? "Saved" : loading ? "Loading…" : "Save changes"}
        </button>
      }
    >
      <div className="mx-auto max-w-4xl space-y-5">
        <SectionCard>
          <p className="mira-eyebrow">Organization</p>
          <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">Company profile</h2>
          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor="company-name" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Company name</label>
              <input id="company-name" aria-label="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mira-input px-4 py-3 text-sm" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto,1fr] sm:items-center">
              <div className="mira-icon-chip h-16 w-16 text-base font-semibold text-slate-700">HP</div>
              <div>
                <button className="mira-button-secondary px-4 py-2 text-sm font-semibold">Upload logo</button>
                <p className="mt-2 text-xs text-slate-500">PNG, SVG, or JPG. Max 2 MB.</p>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Industry</label>
              <select className="mira-select px-4 py-3 text-sm">
                <option>Construction — General Contractor</option>
                <option>Construction — Specialty</option>
                <option>Engineering</option>
                <option>Real Estate Development</option>
                <option>Infrastructure</option>
              </select>
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <p className="mira-eyebrow">AI defaults</p>
          <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">Model and response configuration</h2>
          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor="default-model" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Default LLM model</label>
              <select id="default-model" aria-label="Default LLM model" value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} className="mira-select px-4 py-3 text-sm">
                <option value="google/gemini-2.0-flash">Google Gemini 2.0 Flash (Recommended)</option>
                <option value="google/gemini-2.0-pro">Google Gemini 2.0 Pro</option>
                <option value="openai/gpt-4o">OpenAI GPT-4o</option>
                <option value="anthropic/claude-sonnet-4-20250514">Anthropic Claude Sonnet 4</option>
              </select>
              <p className="mt-2 text-xs text-slate-500">Used as the inherited default model for provisioning and runtime sync across agents.</p>
            </div>
            <div>
              <label htmlFor="response-style" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Response style</label>
              <select id="response-style" value={responseStyle} onChange={(e) => setResponseStyle(e.target.value)} className="mira-select px-4 py-3 text-sm">
                <option value="professional">Professional — Concise and direct</option>
                <option value="detailed">Detailed — Thorough explanations</option>
                <option value="conversational">Conversational — Friendly and approachable</option>
              </select>
            </div>
            <div>
              <label htmlFor="shared-llm-api-key" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Shared LLM API key</label>
              <input
                id="shared-llm-api-key"
                aria-label="Shared LLM API key"
                type="password"
                value={sharedApiKey}
                onChange={(e) => setSharedApiKey(e.target.value)}
                placeholder={hasSharedApiKey ? "A shared provider key is already configured" : "Paste the shared enterprise API key"}
                className="mira-input px-4 py-3 text-sm"
              />
              <p className="mt-2 text-xs text-slate-500">This shared provider key is inherited by agents during provisioning and runtime sync. {hasSharedApiKey ? "A key is already stored." : "No shared key stored yet."}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <p className="mira-eyebrow">Limits</p>
          <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">Usage and retention</h2>
          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor="max-queries" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Max queries per user / day</label>
              <input id="max-queries" type="number" value={maxQueriesPerDay} onChange={(e) => setMaxQueriesPerDay(e.target.value)} className="mira-input px-4 py-3 text-sm" />
            </div>
            <div>
              <label htmlFor="max-agents" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Max active agents</label>
              <input id="max-agents" type="number" value={maxAgents} onChange={(e) => setMaxAgents(e.target.value)} className="mira-input px-4 py-3 text-sm" />
            </div>
            <div>
              <label htmlFor="data-retention" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Data retention (days)</label>
              <input id="data-retention" type="number" value={dataRetention} onChange={(e) => setDataRetention(e.target.value)} className="mira-input px-4 py-3 text-sm" />
            </div>
          </div>
        </SectionCard>

        {error ? (
          <SectionCard className="border-rose-200 bg-rose-50/70">
            <p className="text-sm text-rose-700">{error}</p>
          </SectionCard>
        ) : null}

        <SectionCard className="border-rose-200 bg-rose-50/70">
          <p className="mira-eyebrow text-rose-500">Danger zone</p>
          <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">Destructive operations</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">These actions are intentionally hard to reach. Keep them visible, but unmistakably serious.</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-600">Reset all agents</button>
            <button className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-600">Clear conversation history</button>
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
