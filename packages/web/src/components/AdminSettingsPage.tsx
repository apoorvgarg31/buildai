"use client";

import { useState } from "react";

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
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <header className="flex items-center justify-between pl-14 pr-6 lg:px-6 h-14 border-b border-black/5">
        <div>
          <h2 className="text-sm font-semibold text-[#171717]">Settings</h2>
          <p className="text-[11px] text-[#8e8e8e]">Organization and platform configuration</p>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all ${
            saved
              ? "bg-emerald-500 text-[#171717]"
              : "bg-[#171717] hover:bg-[#333] text-white"
          }`}
        >
          {saved ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </>
          ) : (
            "Save Changes"
          )}
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Company Info */}
          <section className="rounded-xl border border-black/5 bg-[#f9f9f9] p-5">
            <h3 className="text-sm font-semibold text-[#171717] mb-4">Company Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1.5">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-[#e5e5e5] rounded-lg text-[13px] text-[#171717] focus:outline-none focus:border-[#171717]/20 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1.5">Company Logo</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center">
                    <span className="text-2xl font-bold text-[#171717]">HP</span>
                  </div>
                  <div>
                    <button className="px-3 py-1.5 text-[12px] text-[#333] bg-black/[0.04] hover:bg-black/[0.07] border border-[#e5e5e5] rounded-lg transition-colors">
                      Upload New Logo
                    </button>
                    <p className="text-[11px] text-[#666] mt-1">PNG, SVG or JPG. Max 2MB.</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1.5">Industry</label>
                <select className="w-full px-3 py-2.5 bg-white border border-[#e5e5e5] rounded-lg text-[13px] text-[#171717] focus:outline-none focus:border-[#171717]/20">
                  <option>Construction — General Contractor</option>
                  <option>Construction — Specialty</option>
                  <option>Engineering</option>
                  <option>Real Estate Development</option>
                  <option>Infrastructure</option>
                </select>
              </div>
            </div>
          </section>

          {/* AI Configuration */}
          <section className="rounded-xl border border-black/5 bg-[#f9f9f9] p-5">
            <h3 className="text-sm font-semibold text-[#171717] mb-4">AI Configuration</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1.5">Default LLM Provider</label>
                <select
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-[#e5e5e5] rounded-lg text-[13px] text-[#171717] focus:outline-none focus:border-[#171717]/20"
                >
                  <option value="gemini-2.0-flash">Google Gemini 2.0 Flash (Recommended)</option>
                  <option value="gemini-2.0-pro">Google Gemini 2.0 Pro</option>
                  <option value="gpt-4o">OpenAI GPT-4o</option>
                  <option value="claude-3.5-sonnet">Anthropic Claude 3.5 Sonnet</option>
                </select>
                <p className="text-[11px] text-[#666] mt-1">Used as the default model for new agents. Individual agents can override.</p>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1.5">Response Style</label>
                <select className="w-full px-3 py-2.5 bg-white border border-[#e5e5e5] rounded-lg text-[13px] text-[#171717] focus:outline-none focus:border-[#171717]/20">
                  <option>Professional — Concise and direct</option>
                  <option>Detailed — Thorough explanations</option>
                  <option>Conversational — Friendly and approachable</option>
                </select>
              </div>
            </div>
          </section>

          {/* Usage Limits */}
          <section className="rounded-xl border border-black/5 bg-[#f9f9f9] p-5">
            <h3 className="text-sm font-semibold text-[#171717] mb-4">Usage Limits</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1.5">Max Queries Per User / Day</label>
                <input
                  type="number"
                  value={maxQueriesPerDay}
                  onChange={(e) => setMaxQueriesPerDay(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-[#e5e5e5] rounded-lg text-[13px] text-[#171717] focus:outline-none focus:border-[#171717]/20 transition-colors"
                />
                <p className="text-[11px] text-[#666] mt-1">Set to 0 for unlimited. Current avg: 77 queries/user/day.</p>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1.5">Max Active Agents</label>
                <input
                  type="number"
                  value={maxAgents}
                  onChange={(e) => setMaxAgents(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-[#e5e5e5] rounded-lg text-[13px] text-[#171717] focus:outline-none focus:border-[#171717]/20 transition-colors"
                />
                <p className="text-[11px] text-[#666] mt-1">Current plan allows up to 25 agents.</p>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1.5">Data Retention (days)</label>
                <input
                  type="number"
                  value={dataRetention}
                  onChange={(e) => setDataRetention(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-[#e5e5e5] rounded-lg text-[13px] text-[#171717] focus:outline-none focus:border-[#171717]/20 transition-colors"
                />
                <p className="text-[11px] text-[#666] mt-1">Conversation history older than this will be archived. Set to 0 for indefinite.</p>
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="rounded-xl border border-red-500/10 bg-red-500/[0.03] p-5">
            <h3 className="text-sm font-semibold text-red-400 mb-2">Danger Zone</h3>
            <p className="text-[12px] text-[#8e8e8e] mb-4">These actions are irreversible. Please proceed with caution.</p>
            <div className="flex items-center gap-3">
              <button className="px-3 py-1.5 text-[12px] text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors font-medium">
                Reset All Agents
              </button>
              <button className="px-3 py-1.5 text-[12px] text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors font-medium">
                Clear Conversation History
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
