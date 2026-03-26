"use client";

import { useState, useEffect, useCallback } from "react";
import { EmptyState, PageShell, SectionCard } from "./MiraShell";

interface Connection {
  id: string;
  name: string;
  type: string;
  auth_mode: 'shared' | 'oauth_user' | 'token_user';
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
  unifier: "Cost management",
  llm: "LLM provider",
};

const statusConfig: Record<string, string> = {
  connected: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  error: "bg-rose-100 text-rose-700",
};

const authModeLabels: Record<Connection['auth_mode'], string> = {
  shared: 'Shared enterprise access',
  oauth_user: 'Admin app + user sign-in',
  token_user: 'User token required',
};

function defaultAuthMode(type: string): Connection['auth_mode'] {
  return type === 'procore' ? 'oauth_user' : 'shared';
}

export default function AdminConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("database");
  const [formHost, setFormHost] = useState("");
  const [formPort, setFormPort] = useState("5432");
  const [formDbName, setFormDbName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formClientId, setFormClientId] = useState("");
  const [formClientSecret, setFormClientSecret] = useState("");
  const [formOauthBaseUrl, setFormOauthBaseUrl] = useState("https://login.procore.com");
  const [formAuthMode, setFormAuthMode] = useState<Connection['auth_mode']>('shared');

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/connections");
      if (res.ok) setConnections(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleAdd = async () => {
    try {
      let config: Record<string, string>;
      let secrets: Record<string, string>;

      if (formType === "procore") {
        config = { clientId: formClientId, oauthBaseUrl: formOauthBaseUrl };
        secrets = { clientSecret: formClientSecret };
      } else {
        config = { host: formHost, port: formPort, dbName: formDbName };
        secrets = { username: formUsername, password: formPassword };
      }

      const res = await fetch("/api/admin/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, type: formType, authMode: formAuthMode, config, secrets }),
      });
      if (res.ok) {
        setShowAddModal(false);
        setFormName("");
        setFormHost("");
        setFormPort("5432");
        setFormDbName("");
        setFormUsername("");
        setFormPassword("");
        setFormClientId("");
        setFormClientSecret("");
        setFormOauthBaseUrl("https://login.procore.com");
        setFormAuthMode(defaultAuthMode('database'));
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
      fetchConnections();
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
    <PageShell
      title="Connections"
      subtitle="Wire Mira into PMIS, schedules, databases, and document systems with a polished control layer."
      eyebrow="Admin workspace"
      actions={<button onClick={() => setShowAddModal(true)} className="mira-button-primary px-4 py-2 text-xs font-semibold">Add connection</button>}
    >
      <div className="mx-auto max-w-6xl space-y-4">
        {testResult && (
          <SectionCard className={testResult.startsWith("✅") ? "border-emerald-200 bg-emerald-50/80" : "border-rose-200 bg-rose-50/80"}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className={testResult.startsWith("✅") ? "text-emerald-700" : "text-rose-700"}>{testResult}</span>
              <button onClick={() => setTestResult(null)} className="text-slate-500">✕</button>
            </div>
          </SectionCard>
        )}

        {loading ? (
          <SectionCard><p className="text-sm text-slate-500">Loading connections…</p></SectionCard>
        ) : connections.length === 0 ? (
          <EmptyState icon="⟷" title="No integrations yet" description="Add your first connection to bring live systems and project data into Mira." hint="Admin setup" />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {connections.map((conn) => {
              const config = JSON.parse(conn.config || "{}");
              return (
                <SectionCard key={conn.id} className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="mira-icon-chip text-xl">{typeIcons[conn.type] || "🔗"}</div>
                      <div>
                        <h3 className="text-base font-semibold tracking-[-0.03em] text-slate-950">{conn.name}</h3>
                        <p className="mt-1 text-xs text-slate-500">{typeLabels[conn.type] || conn.type}</p>
                      </div>
                    </div>
                    <span className={`mira-pill ${statusConfig[conn.status] || "bg-slate-100 text-slate-600"}`}>{conn.status}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="mira-surface-muted rounded-[1.1rem] px-4 py-3">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400">Auth model</p>
                      <p className="mt-2 text-sm text-slate-700">{authModeLabels[conn.auth_mode]}</p>
                    </div>
                    {conn.type === "procore" ? (
                      <>
                        <div className="mira-surface-muted rounded-[1.1rem] px-4 py-3">
                          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400">Client ID</p>
                          <p className="mt-2 font-mono text-sm text-slate-700">{config.clientId ? "••••" + config.clientId.slice(-4) : "-"}</p>
                        </div>
                        <div className="mira-surface-muted rounded-[1.1rem] px-4 py-3">
                          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400">Environment</p>
                          <p className="mt-2 text-sm text-slate-700">{config.oauthBaseUrl?.includes("sandbox") ? "Sandbox" : "Production"}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mira-surface-muted rounded-[1.1rem] px-4 py-3">
                          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400">Host</p>
                          <p className="mt-2 font-mono text-sm text-slate-700">{config.host || "local socket"}</p>
                        </div>
                        <div className="mira-surface-muted rounded-[1.1rem] px-4 py-3">
                          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400">Target</p>
                          <p className="mt-2 font-mono text-sm text-slate-700">{config.dbName || config.companyId || "-"}</p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-slate-200/60 pt-4">
                    <p className="text-xs text-slate-500">{conn.has_secret ? "Credentials stored" : "No credentials stored"}</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleTest(conn.id)} disabled={testingId === conn.id} className="mira-button-secondary px-4 py-2 text-xs font-semibold disabled:opacity-50">
                        {testingId === conn.id ? "Testing…" : "Test"}
                      </button>
                      <button onClick={() => handleDelete(conn.id)} className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50">
                        Delete
                      </button>
                    </div>
                  </div>
                </SectionCard>
              );
            })}
          </div>
        )}

        {!loading && connections.length > 0 && (
          <p className="text-xs text-slate-500">{connections.length} integrations total · {connectedCount} connected</p>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div className="mira-surface w-full max-w-xl rounded-[1.8rem] p-6" onClick={(e) => e.stopPropagation()}>
            <p className="mira-eyebrow">New connection</p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-950">Add an integration</h3>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Connection name</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Project Database" className="mira-input px-4 py-3 text-sm" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Type</label>
                <select value={formType} onChange={(e) => {
                  const nextType = e.target.value;
                  setFormType(nextType);
                  setFormAuthMode(defaultAuthMode(nextType));
                }} className="mira-select px-4 py-3 text-sm">
                  <option value="database">Database (PostgreSQL)</option>
                  <option value="procore">Procore (PMIS)</option>
                  <option value="p6">Primavera P6</option>
                  <option value="unifier">Unifier</option>
                  <option value="documents">Documents</option>
                  <option value="llm">LLM Provider</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Authentication model</label>
                <select value={formAuthMode} onChange={(e) => setFormAuthMode(e.target.value as Connection['auth_mode'])} className="mira-select px-4 py-3 text-sm">
                  <option value="shared">Shared enterprise access</option>
                  <option value="oauth_user">Admin app + user sign-in</option>
                  <option value="token_user">User token required</option>
                </select>
              </div>

              {formType === "procore" ? (
                <>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Client ID</label>
                    <input type="text" value={formClientId} onChange={(e) => setFormClientId(e.target.value)} placeholder="Your Procore app client ID" className="mira-input px-4 py-3 font-mono text-sm" />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Client secret</label>
                    <input type="password" value={formClientSecret} onChange={(e) => setFormClientSecret(e.target.value)} placeholder="••••••••" className="mira-input px-4 py-3 font-mono text-sm" />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Environment</label>
                    <select value={formOauthBaseUrl} onChange={(e) => setFormOauthBaseUrl(e.target.value)} className="mira-select px-4 py-3 text-sm">
                      <option value="https://login.procore.com">Production</option>
                      <option value="https://login-sandbox-monthly.procore.com">Monthly Sandbox</option>
                      <option value="https://login-sandbox.procore.com">Dev Sandbox</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Host</label>
                      <input type="text" value={formHost} onChange={(e) => setFormHost(e.target.value)} placeholder="localhost" className="mira-input px-4 py-3 font-mono text-sm" />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Port</label>
                      <input type="text" value={formPort} onChange={(e) => setFormPort(e.target.value)} placeholder="5432" className="mira-input px-4 py-3 font-mono text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Database name</label>
                    <input type="text" value={formDbName} onChange={(e) => setFormDbName(e.target.value)} placeholder="mira_demo" className="mira-input px-4 py-3 font-mono text-sm" />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Username</label>
                      <input type="text" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} placeholder="db_user" className="mira-input px-4 py-3 text-sm" />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Password</label>
                      <input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="••••••••" className="mira-input px-4 py-3 text-sm" />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="mira-button-secondary px-4 py-2 text-sm font-semibold">Cancel</button>
              <button onClick={handleAdd} disabled={!formName || !formType} className="mira-button-primary px-4 py-2 text-sm font-semibold disabled:opacity-50">
                Add connection
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
