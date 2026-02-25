"use client";

import { useEffect, useState } from 'react';

type Item = {
  id: string;
  system: string;
  entityType: string;
  entityId: string;
  label: string;
  createdAt: string;
};

export default function WatchlistPage({ agentId }: { agentId?: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [system, setSystem] = useState('Procore');
  const [entityType, setEntityType] = useState('RFI');
  const [entityId, setEntityId] = useState('');
  const [label, setLabel] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let mounted = true;
    fetch(`/api/watchlist${agentId ? `?agentId=${encodeURIComponent(agentId)}` : ''}`)
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        setItems(data.items || []);
      });
    return () => {
      mounted = false;
    };
  }, [agentId]);

  async function addItem() {
    if (!entityId.trim()) return;
    const res = await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, system, entityType, entityId, label }),
    });
    const data = await res.json();
    setMsg(res.ok ? 'Added to watchlist and synced to heartbeat.' : data.error || 'Failed');
    if (res.ok) {
      setEntityId('');
      setLabel('');
      setItems(data.items || []);
    }
  }

  async function removeItem(id: string) {
    const res = await fetch('/api/watchlist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, id }),
    });
    const data = await res.json();
    if (res.ok) setItems(data.items || []);
  }

  return (
    <div className="h-full overflow-auto bg-white p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#171717]">Watchlist</h1>
          <p className="text-sm text-[#666] mt-1">Track entities you care about. We sync this to HEARTBEAT automatically.</p>
        </div>

        <div className="rounded-2xl border border-black/10 p-4 grid grid-cols-1 md:grid-cols-5 gap-2">
          <input className="border border-black/10 rounded-xl px-3 py-2 text-sm" value={system} onChange={(e) => setSystem(e.target.value)} placeholder="System" />
          <input className="border border-black/10 rounded-xl px-3 py-2 text-sm" value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="Type" />
          <input className="border border-black/10 rounded-xl px-3 py-2 text-sm" value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="ID (e.g. 102)" />
          <input className="border border-black/10 rounded-xl px-3 py-2 text-sm" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" />
          <button onClick={addItem} className="rounded-xl bg-black text-white text-sm px-3 py-2">Add</button>
        </div>
        {msg && <p className="text-xs text-[#666]">{msg}</p>}

        <div className="rounded-2xl border border-black/10 divide-y divide-black/5">
          {items.length === 0 ? (
            <p className="p-4 text-sm text-[#777]">No watch items yet.</p>
          ) : items.map((i) => (
            <div key={i.id} className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#171717]">[{i.system}] {i.entityType} {i.entityId}</p>
                <p className="text-xs text-[#666]">{i.label}</p>
              </div>
              <button onClick={() => removeItem(i.id)} className="text-xs px-2 py-1 rounded-lg border border-black/10">Remove</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
