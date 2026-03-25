"use client";

import { useState, useEffect, useCallback } from "react";
import { EmptyState, PageShell, SectionCard } from "./MiraShell";

interface Agent {
  id: string;
  name: string;
  user_id: string | null;
  model: string;
  api_key: string | null;
  workspace_dir: string;
  status: string;
  connection_ids: string[];
  created_at: string;
  updated_at: string;
}

interface Connection {
  id: string;
  name: string;
  type: string;
  status: string;
}

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formName, setFormName] = useState("");
  const [formModel, setFormModel] = useState("google/gemini-2.0-flash");
  const [formApiKey, setFormApiKey] = useState("");
  const [selectedConnections, setSelectedConnections] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, connsRes] = await Promise.all([
        fetch("/api/admin/agents"),
        fetch("/api/admin/connections"),
      ]);
      if (agentsRes.ok) setAgents(await agentsRes.json());
      if (connsRes.ok) setConnections(await connsRes.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/admin/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          model: formModel,
          apiKey: formApiKey || undefined,
          connectionIds: selectedConnections,
        }),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setFormName("");
        setFormApiKey("");
        setSelectedConnections([]);
        fetchData();
      } else {
        const data = await res.json();
        setCreateError(data.error || "Failed to create agent");
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Network error");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this agent and its workspace?")) return;
    await fetch(`/api/admin/agents/${id}`, { method: "DELETE" });
    fetchData();
  };

  const toggleConnection = (connId: string) => {
    setSelectedConnections((prev) =>
      prev.includes(connId) ? prev.filter((c) => c !== connId) : [...prev, connId]
    );
  };

  const getConnectionNames = (ids: string[]) => ids.map((id) => connections.find((c) => c.id === id)?.name || id).join(", ");

  return (
    <PageShell
      title="Agents"
      subtitle="Provision Mira agents with the right model, credentials, and connection stack for each workflow."
      eyebrow="Admin workspace"
      actions={<button onClick={() => setShowCreateModal(true)} className="mira-button-primary px-4 py-2 text-xs font-semibold">Create agent</button>}
    >
      <div className="mx-auto max-w-6xl">
        {loading ? (
          <SectionCard><p className="text-sm text-slate-500">Loading agents…</p></SectionCard>
        ) : agents.length === 0 ? (
          <EmptyState icon="✦" title="No agents yet" description="Create an agent after wiring at least one model key and the connections it should reason over." hint="Admin setup" />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {agents.map((agent) => (
              <SectionCard key={agent.id} className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="mira-icon-chip text-lg">✦</div>
                    <div>
                      <h3 className="text-base font-semibold tracking-[-0.03em] text-slate-950">{agent.name}</h3>
                      <p className="mt-1 text-xs font-mono text-slate-500">{agent.id}</p>
                    </div>
                  </div>
                  <span className={`mira-pill ${agent.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {agent.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="mira-surface-muted rounded-[1.1rem] px-4 py-3">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400">Model</p>
                    <p className="mt-2 text-sm text-slate-900">{agent.model.split("/").pop()}</p>
                  </div>
                  <div className="mira-surface-muted rounded-[1.1rem] px-4 py-3">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400">API key</p>
                    <p className={`mt-2 text-sm ${agent.api_key ? "text-emerald-700" : "text-rose-600"}`}>{agent.api_key ? "Configured" : "Missing"}</p>
                  </div>
                  <div className="mira-surface-muted rounded-[1.1rem] px-4 py-3 sm:col-span-2">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400">Connections</p>
                    <p className="mt-2 text-sm text-slate-900">{agent.connection_ids.length > 0 ? getConnectionNames(agent.connection_ids) : "None assigned"}</p>
                  </div>
                  <div className="mira-surface-muted rounded-[1.1rem] px-4 py-3 sm:col-span-2">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400">Session route</p>
                    <p className="mt-2 break-all font-mono text-xs text-slate-500">agent:{agent.id}:webchat:default</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-slate-200/60 pt-4">
                  <p className="text-xs text-slate-500">Created {new Date(agent.created_at + "Z").toLocaleDateString()}</p>
                  <button onClick={() => handleDelete(agent.id)} className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50">
                    Delete
                  </button>
                </div>
              </SectionCard>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
          <div className="mira-surface w-full max-w-xl rounded-[1.8rem] p-6" onClick={(e) => e.stopPropagation()}>
            <p className="mira-eyebrow">New agent</p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-950">Create a Mira worker</h3>

            {createError && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{createError}</div>}

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Agent name</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Sarah's PM Agent" className="mira-input px-4 py-3 text-sm" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Model</label>
                <select value={formModel} onChange={(e) => setFormModel(e.target.value)} className="mira-select px-4 py-3 text-sm">
                  <option value="google/gemini-2.0-flash">Gemini 2.0 Flash (Recommended)</option>
                  <option value="anthropic/claude-sonnet-4-20250514">Claude Sonnet 4</option>
                  <option value="anthropic/claude-opus-4-6">Claude Opus 4</option>
                  <option value="openai/gpt-4o">GPT-4o</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">API key</label>
                <input
                  type="password"
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  placeholder={formModel.startsWith("anthropic") ? "sk-ant-..." : formModel.startsWith("openai") ? "sk-..." : "Provider API key"}
                  className="mira-input px-4 py-3 font-mono text-sm"
                />
                <p className="mt-2 text-xs text-slate-500">Required so the agent can call its assigned model.</p>
              </div>
              {connections.length > 0 && (
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Connections</label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {connections.map((conn) => (
                      <label key={conn.id} className="mira-surface-muted flex items-center gap-3 rounded-[1rem] px-4 py-3 text-sm text-slate-700">
                        <input type="checkbox" checked={selectedConnections.includes(conn.id)} onChange={() => toggleConnection(conn.id)} />
                        <span className="min-w-0 flex-1 truncate">{conn.name}</span>
                        <span className="text-xs text-slate-400">{conn.type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => setShowCreateModal(false)} className="mira-button-secondary px-4 py-2 text-sm font-semibold">Cancel</button>
              <button onClick={handleCreate} disabled={!formName || !formApiKey || creating} className="mira-button-primary px-4 py-2 text-sm font-semibold disabled:opacity-50">
                {creating ? "Creating…" : "Create agent"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
