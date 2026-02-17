"use client";

import { useState } from "react";

interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  installed: boolean;
  version: string;
  developer: string;
}

const SKILLS: Skill[] = [
  {
    id: "procore",
    name: "Procore",
    description: "Full PMIS integration — pull RFIs, submittals, daily logs, and project financials directly into your AI assistant.",
    category: "PMIS",
    icon: "🏗️",
    installed: true,
    version: "2.4.1",
    developer: "BuildAI Core",
  },
  {
    id: "sharepoint",
    name: "SharePoint",
    description: "Connect to SharePoint document libraries for seamless document search, retrieval, and AI-powered analysis.",
    category: "Documents",
    icon: "📁",
    installed: true,
    version: "1.8.0",
    developer: "BuildAI Core",
  },
  {
    id: "primavera-p6",
    name: "Primavera P6",
    description: "Oracle Primavera P6 scheduling integration — query schedules, critical paths, float analysis, and delay impacts.",
    category: "Scheduling",
    icon: "📅",
    installed: false,
    version: "1.2.0",
    developer: "BuildAI Core",
  },
  {
    id: "unifier",
    name: "Unifier",
    description: "Oracle Unifier cost management — access cost sheets, change orders, budget forecasts, and earned value data.",
    category: "Cost Management",
    icon: "💰",
    installed: false,
    version: "1.0.3",
    developer: "BuildAI Core",
  },
  {
    id: "autocad-viewer",
    name: "AutoCAD Viewer",
    description: "View and reference AutoCAD drawings within conversations. AI can interpret floor plans and markup details.",
    category: "Documents",
    icon: "📐",
    installed: false,
    version: "0.9.1",
    developer: "BuildAI Labs",
  },
  {
    id: "slack",
    name: "Slack Notifications",
    description: "Push AI insights and alerts to Slack channels. Get notified about RFI deadlines, budget overruns, and schedule risks.",
    category: "Communication",
    icon: "💬",
    installed: false,
    version: "1.5.2",
    developer: "BuildAI Core",
  },
  {
    id: "power-bi",
    name: "Power BI",
    description: "Connect Power BI dashboards for real-time analytics. Ask questions about your BI data in natural language.",
    category: "Analytics",
    icon: "📊",
    installed: false,
    version: "1.1.0",
    developer: "BuildAI Core",
  },
  {
    id: "bim360",
    name: "BIM 360",
    description: "Autodesk BIM 360 integration — access model data, issues, clash reports, and field management from conversations.",
    category: "PMIS",
    icon: "🧊",
    installed: false,
    version: "1.3.2",
    developer: "BuildAI Labs",
  },
  {
    id: "bluebeam",
    name: "Bluebeam",
    description: "Bluebeam Revu integration — search annotations, markups, and punch lists across your PDF document sets.",
    category: "Documents",
    icon: "🔵",
    installed: false,
    version: "0.8.0",
    developer: "BuildAI Labs",
  },
  {
    id: "safety-ai",
    name: "Safety AI",
    description: "AI-powered safety compliance — analyze incident reports, OSHA requirements, and generate safety briefings automatically.",
    category: "Compliance",
    icon: "🛡️",
    installed: false,
    version: "1.0.0",
    developer: "BuildAI Core",
  },
];

const CATEGORIES = ["All", "PMIS", "Scheduling", "Cost Management", "Documents", "Analytics", "Communication", "Compliance"];

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [skills, setSkills] = useState<Skill[]>(SKILLS);

  const filtered = skills.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === "All" || s.category === category;
    return matchSearch && matchCategory;
  });

  const installed = filtered.filter((s) => s.installed);
  const available = filtered.filter((s) => !s.installed);

  const handleInstall = (id: string) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, installed: true } : s))
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Header */}
      <header className="flex items-center justify-between pl-14 pr-6 lg:px-6 h-14 border-b border-white/5 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-white">Marketplace</h2>
          <p className="text-[11px] text-gray-500">
            Browse and install skills &amp; integrations
          </p>
        </div>
        <span className="text-[11px] text-gray-500 bg-white/5 px-2.5 py-1 rounded-full">
          {skills.filter((s) => s.installed).length} installed
        </span>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search skills & integrations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#171717] border border-white/5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/30 transition-colors"
              />
            </div>
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                  category === cat
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                    : "bg-white/5 text-gray-400 border border-transparent hover:bg-white/10 hover:text-gray-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Installed section */}
          {installed.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Installed ({installed.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {installed.map((skill) => (
                  <SkillCard key={skill.id} skill={skill} onInstall={handleInstall} />
                ))}
              </div>
            </div>
          )}

          {/* Available section */}
          {available.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Available ({available.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {available.map((skill) => (
                  <SkillCard key={skill.id} skill={skill} onInstall={handleInstall} />
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-500 text-sm">No skills match your search.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SkillCard({
  skill,
  onInstall,
}: {
  skill: Skill;
  onInstall: (id: string) => void;
}) {
  return (
    <div className="group rounded-xl border border-white/5 bg-[#171717] p-4 hover:border-white/10 hover:bg-[#1c1c1c] transition-all duration-200">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-xl shrink-0">
          {skill.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-[13px] font-semibold text-white truncate">
              {skill.name}
            </h4>
            <span className="text-[10px] text-gray-500 shrink-0">
              v{skill.version}
            </span>
          </div>
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-gray-400">
            {skill.category}
          </span>
        </div>
      </div>
      <p className="mt-3 text-[12px] text-gray-400 leading-relaxed line-clamp-2">
        {skill.description}
      </p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[10px] text-gray-600">{skill.developer}</span>
        {skill.installed ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Installed
          </span>
        ) : (
          <button
            onClick={() => onInstall(skill.id)}
            className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
}
