"use client";

import { useEffect, useState } from "react";
import { EmptyState, PageShell, SectionCard } from "./MiraShell";

type Item = { id: string; system: string; entityType: string; entityId: string; label: string; createdAt: string; };

export default function WatchlistPage({ agentId }: { agentId?: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [system, setSystem] = useState("Procore");
  const [entityType, setEntityType] = useState("RFI");
  const [entityId, setEntityId] = useState("");
  const [label, setLabel] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let mounted = true;
    fetch(`/api/watchlist${agentId ? `?agentId=${encodeURIComponent(agentId)}` : ""}`).then((r) => r.json()).then((data) => { if (mounted) setItems(data.items || []); });
    return () => { mounted = false; };
  }, [agentId]);

  async function addItem() {
    if (!entityId.trim()) return;
    const res = await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId, system, entityType, entityId, label }) });
    const data = await res.json();
    setMsg(res.ok ? "Added to watchlist and synced to heartbeat." : data.error || "Failed");
    if (res.ok) { setEntityId(""); setLabel(""); setItems(data.items || []); }
  }

  async function removeItem(id: string) {
    const res = await fetch("/api/watchlist", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId, id }) });
    const data = await res.json();
    if (res.ok) setItems(data.items || []);
  }

  return (
    <PageShell title="Watchlist" subtitle="Keep a lightweight pulse on the entities that matter most. Mira syncs these into heartbeat-driven follow-through." eyebrow="Monitoring">
      <div className="mx-auto max-w-5xl space-y-5">
        <SectionCard className="grid gap-3 md:grid-cols-5">
          <input className="mira-input px-4 py-3 text-sm" value={system} onChange={(e) => setSystem(e.target.value)} placeholder="System" />
          <input className="mira-input px-4 py-3 text-sm" value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="Type" />
          <input className="mira-input px-4 py-3 text-sm" value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="ID (e.g. 102)" />
          <input className="mira-input px-4 py-3 text-sm" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" />
          <button onClick={addItem} className="mira-button-primary px-4 py-3 text-sm font-semibold">Add item</button>
        </SectionCard>
        {msg && <p className="px-1 text-xs font-medium text-slate-500">{msg}</p>}
        {items.length === 0 ? <EmptyState icon="◔" title="Nothing on the watchlist yet" description="Add a system entity and Mira will keep it visible for recurring monitoring and proactive follow-up." /> : <div className="space-y-3">{items.map((i) => <SectionCard key={i.id} className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-slate-950">[{i.system}] {i.entityType} {i.entityId}</p><p className="mt-1 text-xs text-slate-500">{i.label || "No label"}</p></div><button onClick={() => removeItem(i.id)} className="mira-button-secondary px-4 py-2 text-xs font-semibold">Remove</button></SectionCard>)}</div>}
      </div>
    </PageShell>
  );
}
