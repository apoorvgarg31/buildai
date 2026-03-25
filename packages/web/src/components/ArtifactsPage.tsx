"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, PageShell, SectionCard } from "./MiraShell";

interface Artifact {
  id: string;
  name: string;
  size: number;
  type: string;
  createdAt: string;
}

interface ArtifactsPageProps {
  agentId?: string;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ArtifactsPage({ agentId }: ArtifactsPageProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadArtifacts = useCallback(async () => {
    if (!agentId) {
      setArtifacts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/artifacts?agentId=${encodeURIComponent(agentId)}`);
      if (!res.ok) throw new Error("Failed to load artifacts");
      const data = await res.json();
      setArtifacts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load artifacts");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  const deleteArtifact = useCallback(async (name: string) => {
    if (!agentId) return;
    if (!confirm(`Delete ${name}?`)) return;
    const res = await fetch(`/api/artifacts/${encodeURIComponent(name)}?agentId=${encodeURIComponent(agentId)}`, { method: "DELETE" });
    if (res.ok) setArtifacts((prev) => prev.filter((a) => a.name !== name));
  }, [agentId]);

  useEffect(() => { loadArtifacts(); }, [loadArtifacts]);

  return (
    <PageShell title="Artifacts" subtitle="Every generated document, spreadsheet, image, and deliverable in one clean library." eyebrow="Workspace outputs" actions={<button onClick={loadArtifacts} className="mira-button-secondary px-4 py-2 text-xs font-semibold">Refresh</button>}>
      <div className="mx-auto max-w-5xl space-y-4">
        {loading ? <SectionCard><p className="text-sm text-slate-500">Loading artifacts...</p></SectionCard> : error ? <SectionCard><p className="text-sm text-red-500">{error}</p></SectionCard> : artifacts.length === 0 ? <EmptyState icon="◨" title="No artifacts yet" description="Ask Mira to generate a file, and it will appear here with download and cleanup controls." /> : artifacts.map((a) => (
          <SectionCard key={a.id} className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">{a.name}</p>
              <p className="mt-1 text-xs text-slate-500">{formatBytes(a.size)} · {new Date(a.createdAt).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2 pl-4">
              <a href={`/api/artifacts/${encodeURIComponent(a.name)}?agentId=${encodeURIComponent(agentId || "")}`} className="mira-button-secondary px-4 py-2 text-xs font-semibold">Download</a>
              <button onClick={() => deleteArtifact(a.name)} className="rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600">Delete</button>
            </div>
          </SectionCard>
        ))}
      </div>
    </PageShell>
  );
}
