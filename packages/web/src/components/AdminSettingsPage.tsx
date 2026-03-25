"use client";

import { useState } from "react";
import { PageShell, SectionCard } from "./MiraShell";

export default function AdminSettingsPage() {
  const [companyName, setCompanyName] = useState("Hensel Phelps");
  const [llmProvider, setLlmProvider] = useState("gemini-2.0-flash");
  const [maxQueriesPerDay, setMaxQueriesPerDay] = useState("500");
  const [maxAgents, setMaxAgents] = useState("10");
  const [dataRetention, setDataRetention] = useState("90");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
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
          {saved ? "Saved" : "Save changes"}
        </button>
      }
    >
      <div className="mx-auto max-w-4xl space-y-5">
        <SectionCard>
          <p className="mira-eyebrow">Organization</p>
          <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">Company profile</h2>
          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Company name</label>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mira-input px-4 py-3 text-sm" />
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
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Default LLM provider</label>
              <select value={llmProvider} onChange={(e) => setLlmProvider(e.target.value)} className="mira-select px-4 py-3 text-sm">
                <option value="gemini-2.0-flash">Google Gemini 2.0 Flash (Recommended)</option>
                <option value="gemini-2.0-pro">Google Gemini 2.0 Pro</option>
                <option value="gpt-4o">OpenAI GPT-4o</option>
                <option value="claude-3.5-sonnet">Anthropic Claude 3.5 Sonnet</option>
              </select>
              <p className="mt-2 text-xs text-slate-500">Used as the default model for new agents. Individual agents can override.</p>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Response style</label>
              <select className="mira-select px-4 py-3 text-sm">
                <option>Professional — Concise and direct</option>
                <option>Detailed — Thorough explanations</option>
                <option>Conversational — Friendly and approachable</option>
              </select>
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <p className="mira-eyebrow">Limits</p>
          <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">Usage and retention</h2>
          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Max queries per user / day</label>
              <input type="number" value={maxQueriesPerDay} onChange={(e) => setMaxQueriesPerDay(e.target.value)} className="mira-input px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Max active agents</label>
              <input type="number" value={maxAgents} onChange={(e) => setMaxAgents(e.target.value)} className="mira-input px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Data retention (days)</label>
              <input type="number" value={dataRetention} onChange={(e) => setDataRetention(e.target.value)} className="mira-input px-4 py-3 text-sm" />
            </div>
          </div>
        </SectionCard>

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
