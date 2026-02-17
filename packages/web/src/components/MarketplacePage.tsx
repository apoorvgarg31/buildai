"use client";

import { useEffect, useState } from "react";

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
}

export default function MarketplacePage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/marketplace/skills")
      .then((r) => r.json())
      .then((data) => {
        setSkills(data.skills || []);
        setCategories(data.categories || []);
      })
      .catch(console.error);
  }, []);

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
    // Generate install URL — agent will exchange token at this endpoint
    const url = `${window.location.origin}/api/marketplace/skills/${skill.id}/install`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(skill.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <header className="flex items-center justify-between pl-14 pr-6 lg:px-6 h-14 border-b border-black/5 shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-[#171717]">Marketplace</h1>
          <p className="text-[11px] text-[#8e8e8e]">{skills.length} skills available</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Search + Filters */}
        <div className="px-6 pt-5 pb-3 space-y-3">
          <input
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md px-3 py-2 text-sm border border-[#e5e5e5] rounded-lg bg-white text-[#171717] placeholder-[#b4b4b4] focus:outline-none focus:border-[#171717]/30 transition-colors"
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveCategory("All")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeCategory === "All"
                  ? "bg-[#171717] text-white"
                  : "bg-[#f4f4f4] text-[#666] hover:bg-[#e5e5e5]"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-[#171717] text-white"
                    : "bg-[#f4f4f4] text-[#666] hover:bg-[#e5e5e5]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Skill Grid */}
        <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((skill) => (
            <div
              key={skill.id}
              className="group border border-[#e5e5e5] rounded-xl p-4 hover:border-[#d0d0d0] hover:shadow-sm transition-all cursor-pointer"
              onClick={() => setSelectedSkill(skill)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#f4f4f4] flex items-center justify-center text-xl">
                    {skill.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#171717]">{skill.name}</h3>
                    <p className="text-[11px] text-[#8e8e8e]">{skill.vendor} · v{skill.version}</p>
                  </div>
                </div>
                {skill.version === "0.1.0" && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#f4f4f4] text-[#8e8e8e]">
                    Coming Soon
                  </span>
                )}
              </div>

              <p className="text-[13px] text-[#666] leading-relaxed mb-3 line-clamp-2">
                {skill.description}
              </p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#f0f0f0] text-[#666]">
                    {skill.category}
                  </span>
                </div>
                {skill.version !== "0.1.0" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyInstallUrl(skill);
                    }}
                    className="px-3 py-1 rounded-lg text-[11px] font-medium bg-[#171717] text-white hover:bg-[#333] transition-colors"
                  >
                    {copiedId === skill.id ? "✓ Copied" : "Copy Install URL"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-[#8e8e8e]">No skills match your search</p>
          </div>
        )}
      </div>

      {/* Skill Detail Modal */}
      {selectedSkill && (
        <div
          className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedSkill(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e5e5]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#f4f4f4] flex items-center justify-center text-xl">
                  {selectedSkill.icon}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#171717]">{selectedSkill.name}</h2>
                  <p className="text-[11px] text-[#8e8e8e]">
                    {selectedSkill.vendor} · v{selectedSkill.version} · {selectedSkill.category}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSkill(null)}
                className="p-1.5 text-[#8e8e8e] hover:text-[#171717] rounded-lg hover:bg-[#f4f4f4] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="text-[13px] text-[#666] mb-4">{selectedSkill.description}</p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {selectedSkill.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#f0f0f0] text-[#666]">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Install Instructions */}
              {selectedSkill.version !== "0.1.0" && (
                <div className="bg-[#f9f9f9] border border-[#e5e5e5] rounded-xl p-4 mb-4">
                  <h3 className="text-xs font-semibold text-[#171717] mb-2">📦 How to Install</h3>
                  <ol className="text-[12px] text-[#666] space-y-1.5 list-decimal list-inside">
                    <li>Click <strong>Copy Install URL</strong> below</li>
                    <li>Go to your assistant chat</li>
                    <li>Paste the URL and say <em>&quot;Install this skill&quot;</em></li>
                    <li>Your assistant will handle the rest</li>
                  </ol>
                </div>
              )}

              {/* Readme */}
              <div className="prose prose-sm max-w-none">
                <div className="text-[13px] text-[#444] leading-relaxed whitespace-pre-line">
                  {selectedSkill.readme.split('\n').map((line, i) => {
                    if (line.startsWith('# ')) return <h3 key={i} className="text-sm font-semibold text-[#171717] mt-4 mb-2">{line.slice(2)}</h3>;
                    if (line.startsWith('## ')) return <h4 key={i} className="text-[13px] font-semibold text-[#171717] mt-3 mb-1">{line.slice(3)}</h4>;
                    if (line.startsWith('- **')) {
                      const match = line.match(/^- \*\*(.+?)\*\* — (.+)$/);
                      if (match) return <p key={i} className="ml-3 my-0.5"><strong>{match[1]}</strong> — {match[2]}</p>;
                    }
                    if (line.startsWith('- "')) return <p key={i} className="ml-3 my-0.5 text-[#666] italic">{line.slice(2)}</p>;
                    if (line.trim() === '') return <br key={i} />;
                    return <p key={i} className="my-0.5">{line}</p>;
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-[#e5e5e5] flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedSkill(null)}
                className="px-4 py-2 text-[12px] font-medium text-[#666] hover:text-[#171717] transition-colors"
              >
                Close
              </button>
              {selectedSkill.version !== "0.1.0" && (
                <button
                  onClick={() => copyInstallUrl(selectedSkill)}
                  className="px-4 py-2 rounded-lg text-[12px] font-semibold bg-[#171717] text-white hover:bg-[#333] transition-colors"
                >
                  {copiedId === selectedSkill.id ? "✓ Copied!" : "Copy Install URL"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
