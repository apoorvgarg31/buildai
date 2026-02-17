"use client";

import { useState, useEffect, useCallback } from "react";

interface Agent {
  id: string;
  name: string;
  user_id: string | null;
  model: string;
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

  // Form state
  const [formName, setFormName] = useState("");
  const [formModel, setFormModel] = useState("anthropic/claude-sonnet-4-20250514");
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
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
          connectionIds: selectedConnections,
        }),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setFormName(""); setSelectedConnections([]);
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

  const getConnectionNames = (ids: string[]) =>
    ids.map((id) => connections.find((c) => c.id === id)?.name || id).join(", ");

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      <header className="flex items-center justify-between pl-14 pr-6 lg:px-6 h-14 border-b border-white/5">
        <div>
          <h2 className="text-sm font-semibold text-white">Agents</h2>
          <p className="text-[11px] text-gray-500">
            {loading ? "Loading..." : `${agents.length} agent${agents.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[13px] font-semibold transition-colors">
          <span>+</span> Create Agent
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Loading agents...</div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500 text-sm">
            <p>No agents yet</p>
            <p className="text-[11px] mt-1">Create a connection first, then create an agent</p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
            {agents.map((agent) => (
              <div key={agent.id} className="rounded-xl border bg-[#171717] border-white/5 hover:border-white/10 p-5 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center text-xl">🏗️</div>
                    <div>
                      <h3 className="text-[14px] font-semibold text-white">{agent.name}</h3>
                      <p className="text-[11px] text-gray-500 font-mono">{agent.id}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                    agent.status === "active"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${agent.status === "active" ? "bg-emerald-400" : "bg-gray-400"}`} />
                    {agent.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-gray-500">Model</span>
                    <span className="text-gray-300 font-mono text-[11px]">{agent.model.split("/").pop()}</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-gray-500">Connections</span>
                    <span className="text-gray-300">{agent.connection_ids.length > 0 ? getConnectionNames(agent.connection_ids) : "None"}</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-gray-500">Session</span>
                    <span className="text-gray-300 font-mono text-[11px]">agent:{agent.id}:webchat:default</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <span className="text-[11px] text-gray-600">Created {new Date(agent.created_at + "Z").toLocaleDateString()}</span>
                  <button onClick={() => handleDelete(agent.id)} className="px-2.5 py-1 text-[11px] text-red-400 hover:text-red-300 rounded-md hover:bg-red-500/5 transition-colors font-medium">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
          <div className="w-full max-w-md bg-[#171717] border border-white/10 rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Create Agent</h3>

            {createError && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-[12px] border border-red-500/20">{createError}</div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-gray-400 mb-1">Agent Name</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Sarah's PM Agent"
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-[13px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500/30" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-400 mb-1">Model</label>
                <select value={formModel} onChange={(e) => setFormModel(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-[13px] text-gray-200 focus:outline-none focus:border-amber-500/30">
                  <option value="anthropic/claude-sonnet-4-20250514">Claude Sonnet 4 (Recommended)</option>
                  <option value="anthropic/claude-opus-4-6">Claude Opus 4</option>
                  <option value="google/gemini-2.0-flash">Gemini 2.0 Flash</option>
                </select>
              </div>
              {connections.length > 0 && (
                <div>
                  <label className="block text-[12px] font-medium text-gray-400 mb-2">Assign Connections</label>
                  <div className="space-y-1.5">
                    {connections.map((conn) => (
                      <label key={conn.id} className="flex items-center gap-2 px-3 py-2 bg-[#0a0a0a] border border-white/5 rounded-lg cursor-pointer hover:border-white/10">
                        <input type="checkbox" checked={selectedConnections.includes(conn.id)}
                          onChange={() => toggleConnection(conn.id)}
                          className="rounded border-white/20 bg-transparent" />
                        <span className="text-[13px] text-gray-200">{conn.name}</span>
                        <span className="text-[11px] text-gray-500 ml-auto">{conn.type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-[13px] text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">Cancel</button>
              <button onClick={handleCreate} disabled={!formName || creating}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-50">
                {creating ? "Creating..." : "Create Agent"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
