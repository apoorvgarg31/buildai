"use client";

import { useCallback, useEffect, useState } from "react";

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
    const ok = confirm(`Delete ${name}?`);
    if (!ok) return;
    const res = await fetch(`/api/artifacts/${encodeURIComponent(name)}?agentId=${encodeURIComponent(agentId)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setArtifacts((prev) => prev.filter((a) => a.name !== name));
    }
  }, [agentId]);

  useEffect(() => {
    loadArtifacts();
  }, [loadArtifacts]);

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="flex items-center justify-between pl-14 pr-6 lg:px-6 h-14 border-b border-black/5">
        <div>
          <h1 className="text-sm font-semibold text-[#171717]">Artifacts</h1>
          <p className="text-[11px] text-[#8e8e8e]">Generated files from AI (docs, images, PPT, sheets, etc.)</p>
        </div>
        <button onClick={loadArtifacts} className="px-3 py-1.5 rounded-lg text-xs border border-[#e5e5e5] hover:border-[#b4b4b4]">
          Refresh
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="text-sm text-[#8e8e8e]">Loading artifacts...</div>
        ) : error ? (
          <div className="text-sm text-red-500">{error}</div>
        ) : artifacts.length === 0 ? (
          <div className="text-sm text-[#8e8e8e]">No artifacts yet. Ask the assistant to generate files.</div>
        ) : (
          <div className="space-y-2 max-w-4xl">
            {artifacts.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-[#171717] truncate">{a.name}</p>
                  <p className="text-[11px] text-[#8e8e8e]">{formatBytes(a.size)} • {new Date(a.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 pl-4">
                  <a
                    href={`/api/artifacts/${encodeURIComponent(a.name)}?agentId=${encodeURIComponent(agentId || "")}`}
                    className="px-2.5 py-1.5 rounded-md text-xs border border-[#d9d9d9] hover:border-[#b4b4b4]"
                  >
                    Download
                  </a>
                  <button
                    onClick={() => deleteArtifact(a.name)}
                    className="px-2.5 py-1.5 rounded-md text-xs text-red-600 border border-red-200 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
