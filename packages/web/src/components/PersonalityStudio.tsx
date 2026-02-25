"use client";

import { useEffect, useMemo, useState } from 'react';

type FileKey = 'SOUL.md' | 'USER.md' | 'TOOLS.md' | 'ACTIVE.md';

interface Props {
  agentId?: string;
}

interface Recommendation {
  skill: string;
  score: number;
  reasons: string[];
}

function parseSectionList(md: string, sectionTitle: string): string[] {
  const regex = new RegExp(`## ${sectionTitle}([\\s\\S]*?)(\\n## |$)`, 'm');
  const block = md.match(regex)?.[1] || '';
  return block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('-'))
    .map((l) => l.replace(/^-\s*/, '').trim())
    .filter(Boolean);
}

function parseField(md: string, label: string): string {
  const line = md
    .split('\n')
    .find((l) => l.toLowerCase().startsWith(`- ${label.toLowerCase()}:`) || l.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  if (!line) return '';
  return line.split(':').slice(1).join(':').trim();
}

export default function PersonalityStudio({ agentId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<FileKey>('SOUL.md');
  const [mode, setMode] = useState<'guided' | 'files'>('guided');
  const [files, setFiles] = useState<Record<FileKey, string>>({
    'SOUL.md': '',
    'USER.md': '',
    'TOOLS.md': '',
    'ACTIVE.md': '',
  });
  const [quick, setQuick] = useState('');
  const [msg, setMsg] = useState('');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [quickStart, setQuickStart] = useState<string[]>([]);

  const userMd = files['USER.md'];
  const status = (userMd.match(/## Status\n([\s\S]*?)(\n## |$)/m)?.[1] || '').trim();
  const role = parseField(userMd, 'Role');
  const systemsRaw = parseField(userMd, 'Primary systems');
  const systems = systemsRaw.split('/').map((s) => s.trim()).filter(Boolean);
  const painPoints = parseSectionList(userMd, 'Top Pain Points');

  useEffect(() => {
    let mounted = true;
    fetch(`/api/personality/files${agentId ? `?agentId=${encodeURIComponent(agentId)}` : ''}`)
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        if (data.files) {
          setFiles({
            'SOUL.md': data.files.SOUL || '',
            'USER.md': data.files.USER || '',
            'TOOLS.md': data.files.TOOLS || '',
            'ACTIVE.md': data.files.ACTIVE || '',
          });
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [agentId]);

  async function saveCurrent() {
    setSaving(true);
    setMsg('');
    const res = await fetch('/api/personality/files', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, file: tab, content: files[tab] }),
    });
    setSaving(false);
    setMsg(res.ok ? `${tab} saved.` : 'Save failed.');
  }

  async function applyQuickUpdate(text?: string) {
    const instruction = (text ?? quick).trim();
    if (!instruction) return;

    setSaving(true);
    setMsg('');
    const res = await fetch('/api/personality/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, instruction }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    setMsg(data.message || (res.ok ? 'Applied.' : 'Failed to apply update.'));
    if (res.ok && !text) setQuick('');
  }

  async function refreshRecommendations() {
    setMsg('');
    const res = await fetch('/api/personality/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, role, systems, painPoints }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error || 'Could not fetch recommendations.');
      return;
    }

    setRecommendations((data.top_recommendations || []) as Recommendation[]);
    setQuickStart((data.quick_start || []) as string[]);
  }

  const statusBadge = useMemo(() => {
    const v = status.toLowerCase();
    if (v.includes('onboarded') || v.includes('completed')) return 'bg-emerald-100 text-emerald-700';
    if (v.includes('pending')) return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-700';
  }, [status]);

  if (loading) {
    return <div className="p-6 text-sm text-[#666]">Loading Personality Studio...</div>;
  }

  return (
    <div className="h-full overflow-auto bg-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[#171717]">Personality Studio</h1>
            <p className="text-sm text-[#666] mt-1">Make your agent feel personal now and adaptable over time.</p>
          </div>
          <div className="inline-flex rounded-xl border border-black/10 overflow-hidden">
            <button onClick={() => setMode('guided')} className={`px-3 py-2 text-sm ${mode === 'guided' ? 'bg-black text-white' : 'bg-white text-[#444]'}`}>Guided</button>
            <button onClick={() => setMode('files')} className={`px-3 py-2 text-sm ${mode === 'files' ? 'bg-black text-white' : 'bg-white text-[#444]'}`}>Files</button>
          </div>
        </div>

        {mode === 'guided' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-black/10 p-4 bg-[#fafafa]">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge}`}>Status: {status || 'unknown'}</span>
                  <span className="text-xs text-[#666]">Role: {role || 'not set'}</span>
                </div>
                <p className="text-xs text-[#666] mt-2">Systems: {systems.length ? systems.join(', ') : 'not captured yet'}</p>
                {painPoints.length > 0 && (
                  <ul className="mt-2 text-xs text-[#444] list-disc pl-5 space-y-1">
                    {painPoints.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl border border-black/10 p-4">
                <h3 className="text-sm font-semibold text-[#171717]">Quick personality commands</h3>
                <p className="text-xs text-[#666] mt-1">One line is enough. Example: “Be more direct. Send 8:30 AM digest. Alert only critical blockers.”</p>
                <textarea
                  value={quick}
                  onChange={(e) => setQuick(e.target.value)}
                  className="w-full mt-3 p-3 text-sm border border-black/10 rounded-xl min-h-[100px] outline-none"
                  placeholder="Tell your agent how to adapt..."
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => applyQuickUpdate()} disabled={saving || !quick.trim()} className="px-3 py-2 rounded-xl bg-black text-white text-sm disabled:opacity-50">Apply update</button>
                  <button onClick={() => applyQuickUpdate('Use concise bullet updates. Keep tone direct and calm.')} disabled={saving} className="px-3 py-2 rounded-xl border border-black/10 text-sm">Set concise style</button>
                  <button onClick={() => applyQuickUpdate('Be proactive only for critical blockers and schedule slips.')} disabled={saving} className="px-3 py-2 rounded-xl border border-black/10 text-sm">Critical-only alerts</button>
                </div>
              </div>

              <div className="rounded-2xl border border-black/10 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#171717]">Recommended skills</h3>
                  <button onClick={refreshRecommendations} className="px-3 py-1.5 rounded-lg bg-[#171717] text-white text-xs">Refresh</button>
                </div>
                {quickStart.length > 0 && (
                  <p className="text-xs text-[#666] mt-2">Quick start: {quickStart.join(' → ')}</p>
                )}
                <div className="mt-3 space-y-2">
                  {recommendations.length === 0 ? (
                    <p className="text-xs text-[#777]">No recommendations yet. Click Refresh.</p>
                  ) : recommendations.map((r) => (
                    <div key={r.skill} className="rounded-xl border border-black/10 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{r.skill}</p>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/[0.06]">score {r.score}</span>
                      </div>
                      <ul className="mt-1 text-xs text-[#666] list-disc pl-4">
                        {r.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-black/10 p-4 bg-[#fafafa]">
                <h3 className="text-sm font-semibold">What this changes</h3>
                <ul className="mt-2 text-xs text-[#555] space-y-1 list-disc pl-4">
                  <li>Next chat replies become more aligned to user style.</li>
                  <li>Preferences are stored in USER/ACTIVE for continuity.</li>
                  <li>Onboarding can evolve without resetting the agent.</li>
                </ul>
              </div>
              {msg && <div className="rounded-xl border border-black/10 p-3 text-xs text-[#555]">{msg}</div>}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-black/10 overflow-hidden">
            <div className="flex border-b border-black/10 bg-[#fafafa]">
              {(['SOUL.md', 'USER.md', 'TOOLS.md', 'ACTIVE.md'] as FileKey[]).map((f) => (
                <button key={f} onClick={() => setTab(f)} className={`px-4 py-2 text-sm ${tab === f ? 'bg-white font-medium text-[#171717]' : 'text-[#666]'}`}>
                  {f}
                </button>
              ))}
              <div className="ml-auto p-2">
                <button onClick={saveCurrent} disabled={saving} className="px-3 py-1.5 rounded-lg bg-[#171717] text-white text-sm disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
            <textarea
              value={files[tab]}
              onChange={(e) => setFiles((p) => ({ ...p, [tab]: e.target.value }))}
              className="w-full min-h-[560px] p-4 font-mono text-xs outline-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}
