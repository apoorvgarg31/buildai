"use client";

import { useState, useEffect, useCallback } from "react";

interface Connection {
  id: string;
  name: string;
  type: string;
  config: string;
  status: string;
  has_secret: boolean;
  created_at: string;
  updated_at: string;
}

const typeIcons: Record<string, string> = {
  database: "🗄️",
  procore: "🏗️",
  documents: "📁",
  p6: "📅",
  unifier: "💰",
  llm: "🧠",
};

const typeLabels: Record<string, string> = {
  database: "Database",
  procore: "PMIS",
  documents: "Documents",
  p6: "Scheduling",
  unifier: "Cost Management",
  llm: "LLM Provider",
};

const statusConfig: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  connected: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-400", label: "Connected" },
  pending: { bg: "bg-[#171717]/10", text: "text-[#171717]", border: "border-amber-500/20", dot: "bg-amber-400", label: "Pending" },
  error: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", dot: "bg-red-400", label: "Error" },
};

export default function AdminConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("database");
  const [formHost, setFormHost] = useState("");
  const [formPort, setFormPort] = useState("5432");
  const [formDbName, setFormDbName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/connections");
      if (res.ok) setConnections(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  const handleAdd = async () => {
    try {
      const res = await fetch("/api/admin/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          type: formType,
          config: { host: formHost, port: formPort, dbName: formDbName },
          secrets: { username: formUsername, password: formPassword },
        }),
      });
      if (res.ok) {
        setShowAddModal(false);
        setFormName(""); setFormHost(""); setFormPort("5432"); setFormDbName(""); setFormUsername(""); setFormPassword("");
        fetchConnections();
      }
    } catch (err) {
      console.error("Add connection error:", err);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/admin/connections/${id}/test`, { method: "POST" });
      const data = await res.json();
      setTestResult(data.ok ? `✅ ${data.message}` : `❌ ${data.message}`);
      fetchConnections(); // refresh status
    } catch (err) {
      setTestResult(`❌ Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this connection?")) return;
    await fetch(`/api/admin/connections/${id}`, { method: "DELETE" });
    fetchConnections();
  };

  const connectedCount = connections.filter((c) => c.status === "connected").length;

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="flex items-center justify-between pl-14 pr-6 lg:px-6 h-14 border-b border-black/5">
        <div>
          <h2 className="text-sm font-semibold text-[#171717]">Connections</h2>
          <p className="text-[11px] text-[#8e8e8e]">
            {loading ? "Loading..." : `${connections.length} integrations · ${connectedCount} connected`}
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#171717] hover:bg-[#333] text-white text-[13px] font-semibold transition-colors">
          <span>+</span> Add Connection
        </button>
      </header>

      {testResult && (
        <div className={`mx-6 mt-3 px-4 py-2.5 rounded-lg text-[13px] font-medium flex items-center justify-between ${
          testResult.startsWith("✅") ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
        }`}>
          <span>{testResult}</span>
          <button onClick={() => setTestResult(null)} className="ml-3 hover:opacity-70">✕</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-[#8e8e8e] text-sm">Loading connections...</div>
        ) : connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[#8e8e8e] text-sm">
            <p>No connections yet</p>
            <button onClick={() => setShowAddModal(true)} className="mt-2 text-[#171717] hover:text-amber-300 text-sm">Add your first connection</button>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
            {connections.map((conn) => {
              const config = JSON.parse(conn.config || "{}");
              const sc = statusConfig[conn.status] || statusConfig.pending;
              const isTesting = testingId === conn.id;
              return (
                <div key={conn.id} className="rounded-xl border bg-[#f9f9f9] border-black/5 hover:border-[#e5e5e5] p-5 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-black/[0.04] border border-black/5 flex items-center justify-center text-xl">
                        {typeIcons[conn.type] || "🔗"}
                      </div>
                      <div>
                        <h3 className="text-[14px] font-semibold text-[#171717]">{conn.name}</h3>
                        <p className="text-[11px] text-[#8e8e8e]">{typeLabels[conn.type] || conn.type}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${sc.bg} ${sc.text} ${sc.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                      {sc.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <p className="text-[11px] text-[#666]">Host</p>
                      <p className="text-[12px] text-[#333] font-mono">{config.host || "local socket"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#666]">Database</p>
                      <p className="text-[12px] text-[#333] font-mono">{config.dbName || config.companyId || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-black/5">
                    <span className="text-[11px] text-[#666]">{conn.has_secret ? "🔑 Credentials stored" : "No credentials"}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleTest(conn.id)} disabled={isTesting}
                        className={`px-2.5 py-1 text-[11px] rounded-md transition-colors font-medium ${isTesting ? "text-blue-400 bg-blue-500/10" : "text-[#8e8e8e] hover:text-[#171717] hover:bg-black/[0.04]"}`}>
                        {isTesting ? "Testing..." : "Test"}
                      </button>
                      <button onClick={() => handleDelete(conn.id)} className="px-2.5 py-1 text-[11px] text-red-400 hover:text-red-300 rounded-md hover:bg-red-500/5 transition-colors font-medium">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div className="w-full max-w-md bg-[#f9f9f9] border border-[#e5e5e5] rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[#171717] mb-4">Add Connection</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1">Connection Name</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Project Database"
                  className="w-full px-3 py-2 bg-white border border-[#e5e5e5] rounded-lg text-[13px] text-[#171717] placeholder-[#b4b4b4] focus:outline-none focus:border-[#171717]/20" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1">Type</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#e5e5e5] rounded-lg text-[13px] text-[#171717] focus:outline-none focus:border-[#171717]/20">
                  <option value="database">Database (PostgreSQL)</option>
                  <option value="procore">Procore (PMIS)</option>
                  <option value="p6">Primavera P6</option>
                  <option value="unifier">Unifier</option>
                  <option value="documents">Documents</option>
                  <option value="llm">LLM Provider</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1">Host</label>
                  <input type="text" value={formHost} onChange={(e) => setFormHost(e.target.value)} placeholder="localhost (empty for local)"
                    className="w-full px-3 py-2 bg-white border border-[#e5e5e5] rounded-lg text-[13px] text-[#171717] placeholder-[#b4b4b4] focus:outline-none focus:border-[#171717]/20 font-mono text-[12px]" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1">Port</label>
                  <input type="text" value={formPort} onChange={(e) => setFormPort(e.target.value)} placeholder="5432"
                    className="w-full px-3 py-2 bg-white border border-[#e5e5e5] rounded-lg text-[13px] text-[#171717] placeholder-[#b4b4b4] focus:outline-none focus:border-[#171717]/20 font-mono text-[12px]" />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1">Database Name</label>
                <input type="text" value={formDbName} onChange={(e) => setFormDbName(e.target.value)} placeholder="buildai_demo"
                  className="w-full px-3 py-2 bg-white border border-[#e5e5e5] rounded-lg text-[13px] text-[#171717] placeholder-[#b4b4b4] focus:outline-none focus:border-[#171717]/20 font-mono text-[12px]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1">Username</label>
                  <input type="text" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} placeholder="(empty for peer auth)"
                    className="w-full px-3 py-2 bg-white border border-[#e5e5e5] rounded-lg text-[13px] text-[#171717] placeholder-[#b4b4b4] focus:outline-none focus:border-[#171717]/20" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1">Password</label>
                  <input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="••••••••"
                    className="w-full px-3 py-2 bg-white border border-[#e5e5e5] rounded-lg text-[13px] text-[#171717] placeholder-[#b4b4b4] focus:outline-none focus:border-[#171717]/20" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-[13px] text-[#8e8e8e] hover:text-[#171717] transition-colors rounded-lg hover:bg-black/[0.04]">Cancel</button>
              <button onClick={handleAdd} disabled={!formName || !formType}
                className="px-4 py-2 bg-[#171717] hover:bg-[#333] text-white text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-50">
                Add Connection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
