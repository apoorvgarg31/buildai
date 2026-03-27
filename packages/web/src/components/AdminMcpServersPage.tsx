"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, PageShell, SectionCard } from "./MiraShell";

interface McpServer {
  id: string;
  name: string;
  server_kind: 'connector_linked' | 'standalone';
  connection_id?: string | null;
  connection_name?: string | null;
  connection_type?: string | null;
  transport: 'stdio' | 'http' | 'sse';
  command?: string | null;
  url?: string | null;
  status: string;
  enabled: boolean;
  notes?: string | null;
}

interface AvailableConnectorTarget {
  connection_id: string;
  connection_name: string;
  connection_type: string;
}

interface AdminMcpServersPageProps {
  initialServers?: McpServer[];
  initialAvailableConnectorTargets?: AvailableConnectorTarget[];
}

const statusStyles: Record<string, string> = {
  configured: 'bg-sky-100 text-sky-700',
  active: 'bg-emerald-100 text-emerald-700',
  error: 'bg-rose-100 text-rose-700',
};

export default function AdminMcpServersPage({ initialServers, initialAvailableConnectorTargets }: AdminMcpServersPageProps) {
  const [servers, setServers] = useState<McpServer[]>(initialServers || []);
  const [availableConnectorTargets, setAvailableConnectorTargets] = useState<AvailableConnectorTarget[]>(initialAvailableConnectorTargets || []);
  const [loading, setLoading] = useState(!initialServers && !initialAvailableConnectorTargets);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formKind, setFormKind] = useState<'connector_linked' | 'standalone'>('connector_linked');
  const [formConnectionId, setFormConnectionId] = useState('');
  const [formTransport, setFormTransport] = useState<'stdio' | 'http' | 'sse'>('stdio');
  const [formCommand, setFormCommand] = useState('');
  const [formArgs, setFormArgs] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/mcp-servers');
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers || []);
        setAvailableConnectorTargets(data.availableConnectorTargets || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialServers || initialAvailableConnectorTargets) return;
    fetchServers();
  }, [fetchServers, initialAvailableConnectorTargets, initialServers]);

  const openFromConnector = (target: AvailableConnectorTarget) => {
    setFormKind('connector_linked');
    setFormName(`${target.connection_name} MCP`);
    setFormConnectionId(target.connection_id);
    setFormTransport('stdio');
    setFormCommand('npx');
    setFormArgs('');
    setFormUrl('');
    setFormNotes(`Linked to ${target.connection_name} (${target.connection_type}).`);
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    const payload = {
      name: formName,
      serverKind: formKind,
      connectionId: formKind === 'connector_linked' ? formConnectionId : undefined,
      transport: formTransport,
      command: formCommand || undefined,
      args: formArgs ? formArgs.split(/\s+/).filter(Boolean) : [],
      url: formTransport === 'stdio' ? undefined : formUrl || undefined,
      notes: formNotes || undefined,
    };

    const res = await fetch('/api/admin/mcp-servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setShowCreateModal(false);
      setFormName('');
      setFormConnectionId('');
      setFormCommand('');
      setFormArgs('');
      setFormUrl('');
      setFormNotes('');
      fetchServers();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this MCP server?')) return;
    await fetch(`/api/admin/mcp-servers/${id}`, { method: 'DELETE' });
    fetchServers();
  };

  return (
    <PageShell
      title="MCP Servers"
      subtitle="Register connector-linked and standalone MCP servers for runtime tool execution. Connectors stay product-facing; MCP stays an admin/runtime concern."
      eyebrow="Admin workspace"
      actions={<button onClick={() => setShowCreateModal(true)} className="mira-button-primary px-4 py-2 text-xs font-semibold">Add MCP server</button>}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <SectionCard>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mira-eyebrow">Connector-linked suggestion</p>
              <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">Configured connectors waiting for MCP</h2>
              <div className="mt-4 space-y-3">
                {availableConnectorTargets.length === 0 ? (
                  <p className="text-sm text-slate-500">Every configured connector already has an MCP registration.</p>
                ) : availableConnectorTargets.map((target) => (
                  <div key={target.connection_id} className="mira-surface-muted flex items-center justify-between gap-3 rounded-[1.2rem] px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{target.connection_name}</p>
                      <p className="text-xs text-slate-500">{target.connection_type}</p>
                    </div>
                    <button onClick={() => openFromConnector(target)} className="mira-button-secondary px-3 py-2 text-xs font-semibold">Create server</button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mira-eyebrow">Standalone runtime</p>
              <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">Custom MCP servers</h2>
              <p className="mt-4 text-sm leading-6 text-slate-600">Use standalone MCP servers for utility runtimes that are not tied to a business connector. These stay fully admin-managed and internal.</p>
            </div>
          </div>
        </SectionCard>

        {loading ? (
          <SectionCard><p className="text-sm text-slate-500">Loading MCP servers…</p></SectionCard>
        ) : servers.length === 0 ? (
          <EmptyState icon="⌘" title="No MCP servers yet" description="Register connector-linked servers for configured enterprise apps, or add a standalone runtime server." hint="Runtime registry" />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {servers.map((server) => (
              <SectionCard key={server.id} className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold tracking-[-0.03em] text-slate-950">{server.name}</h3>
                      <span className={`mira-pill ${statusStyles[server.status] || 'bg-slate-100 text-slate-600'}`}>{server.status}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{server.server_kind === 'connector_linked' ? 'Connector-linked server' : 'Standalone server'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="mira-surface-muted rounded-[1.1rem] px-4 py-3">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400">Transport</p>
                    <p className="mt-2 text-sm text-slate-700">{server.transport}</p>
                  </div>
                  <div className="mira-surface-muted rounded-[1.1rem] px-4 py-3">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400">Source</p>
                    <p className="mt-2 text-sm text-slate-700">{server.connection_name || 'Custom runtime'}</p>
                  </div>
                  <div className="mira-surface-muted rounded-[1.1rem] px-4 py-3 sm:col-span-2">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400">Entry point</p>
                    <p className="mt-2 break-all font-mono text-xs text-slate-600">{server.command || server.url || 'Configured in runtime'}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-slate-200/60 pt-4">
                  <p className="text-xs text-slate-500">{server.enabled ? 'Enabled for runtime registration' : 'Disabled'}</p>
                  <button onClick={() => handleDelete(server.id)} className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50">Delete</button>
                </div>
              </SectionCard>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
          <div className="mira-surface w-full max-w-xl rounded-[1.8rem] p-6" onClick={(e) => e.stopPropagation()}>
            <p className="mira-eyebrow">New MCP server</p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-950">Register a runtime server</h3>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Server type</label>
                <select value={formKind} onChange={(e) => setFormKind(e.target.value as 'connector_linked' | 'standalone')} className="mira-select px-4 py-3 text-sm">
                  <option value="connector_linked">Connector-linked</option>
                  <option value="standalone">Standalone</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Server name</label>
                <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Linear MCP" className="mira-input px-4 py-3 text-sm" />
              </div>
              {formKind === 'connector_linked' && (
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Connector</label>
                  <select value={formConnectionId} onChange={(e) => setFormConnectionId(e.target.value)} className="mira-select px-4 py-3 text-sm">
                    <option value="">Select connector</option>
                    {availableConnectorTargets.map((target) => (
                      <option key={target.connection_id} value={target.connection_id}>{target.connection_name} · {target.connection_type}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Transport</label>
                <select value={formTransport} onChange={(e) => setFormTransport(e.target.value as 'stdio' | 'http' | 'sse')} className="mira-select px-4 py-3 text-sm">
                  <option value="stdio">stdio</option>
                  <option value="http">http</option>
                  <option value="sse">sse</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Command</label>
                <input value={formCommand} onChange={(e) => setFormCommand(e.target.value)} placeholder="npx" className="mira-input px-4 py-3 font-mono text-sm" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Args</label>
                <input value={formArgs} onChange={(e) => setFormArgs(e.target.value)} placeholder="@vendor/server --flag" className="mira-input px-4 py-3 font-mono text-sm" />
              </div>
              {formTransport !== 'stdio' && (
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">URL</label>
                  <input value={formUrl} onChange={(e) => setFormUrl(e.target.value)} placeholder="https://mcp.internal/runtime" className="mira-input px-4 py-3 font-mono text-sm" />
                </div>
              )}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Notes</label>
                <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Why this server exists and what it exposes." className="mira-input min-h-[120px] px-4 py-3 text-sm" />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => setShowCreateModal(false)} className="mira-button-secondary px-4 py-2 text-sm font-semibold">Cancel</button>
              <button onClick={handleCreate} disabled={!formName} className="mira-button-primary px-4 py-2 text-sm font-semibold disabled:opacity-50">Create server</button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
