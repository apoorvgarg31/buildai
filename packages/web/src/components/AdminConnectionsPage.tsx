"use client";

import { useState } from "react";

interface ConnectionRecord {
  id: string;
  name: string;
  type: string;
  host: string;
  status: "connected" | "pending" | "error";
  lastSynced: string;
  icon: string;
  description: string;
  users: number;
}

const connections: ConnectionRecord[] = [
  {
    id: "1",
    name: "Procore",
    type: "PMIS",
    host: "sandbox.procore.com",
    status: "pending",
    lastSynced: "Not connected",
    icon: "🏗️",
    description: "Project management information system. Real-time sync of projects, RFIs, submittals, and daily logs.",
    users: 0,
  },
  {
    id: "2",
    name: "PostgreSQL",
    type: "Database",
    host: "db.buildai-prod.internal:5432",
    status: "connected",
    lastSynced: "Real-time",
    icon: "🗄️",
    description: "Primary application database. Stores user data, agent configurations, and conversation history.",
    users: 24,
  },
  {
    id: "3",
    name: "Gemini 2.0 Flash",
    type: "LLM Provider",
    host: "generativelanguage.googleapis.com",
    status: "connected",
    lastSynced: "Active",
    icon: "🧠",
    description: "Google AI model powering all BuildAI agents. Low latency, high throughput inference.",
    users: 24,
  },
  {
    id: "4",
    name: "Primavera P6",
    type: "Scheduling",
    host: "p6.hensel-phelps.internal",
    status: "pending",
    lastSynced: "Never",
    icon: "📅",
    description: "Oracle Primavera P6 for CPM scheduling. Awaiting VPN configuration and API credentials.",
    users: 0,
  },
  {
    id: "5",
    name: "Unifier",
    type: "Cost Management",
    host: "unifier.hensel-phelps.internal",
    status: "error",
    lastSynced: "Failed 3h ago",
    icon: "💰",
    description: "Oracle Unifier for cost management and business processes. Connection timeout — credentials may have expired.",
    users: 0,
  },
  {
    id: "6",
    name: "SharePoint",
    type: "Documents",
    host: "henselphelps.sharepoint.com",
    status: "connected",
    lastSynced: "15 min ago",
    icon: "📁",
    description: "Microsoft SharePoint for document management. Indexed 12,847 documents across 6 project sites.",
    users: 18,
  },
];

const statusConfig = {
  connected: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-400", label: "Connected" },
  pending: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", dot: "bg-amber-400", label: "Pending" },
  error: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", dot: "bg-red-400", label: "Error" },
};

export default function AdminConnectionsPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const connectedCount = connections.filter((c) => c.status === "connected").length;

  const handleTest = (id: string) => {
    setTestingId(id);
    setTimeout(() => setTestingId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      <header className="flex items-center justify-between pl-14 pr-6 lg:px-6 h-14 border-b border-white/5">
        <div>
          <h2 className="text-sm font-semibold text-white">Connections</h2>
          <p className="text-[11px] text-gray-500">{connections.length} integrations · {connectedCount} connected</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[13px] font-semibold transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Connection
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
          {connections.map((conn) => {
            const sc = statusConfig[conn.status];
            const isTesting = testingId === conn.id;
            return (
              <div key={conn.id} className="rounded-xl border bg-[#171717] border-white/5 hover:border-white/10 p-5 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-xl">{conn.icon}</div>
                    <div>
                      <h3 className="text-[14px] font-semibold text-white">{conn.name}</h3>
                      <p className="text-[11px] text-gray-500">{conn.type}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${sc.bg} ${sc.text} ${sc.border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                    {sc.label}
                  </span>
                </div>
                <p className="text-[12px] text-gray-400 mb-3 leading-relaxed">{conn.description}</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <p className="text-[11px] text-gray-600">Host</p>
                    <p className="text-[12px] text-gray-300 font-mono">{conn.host}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-600">Last Synced</p>
                    <p className={`text-[12px] font-medium ${conn.status === "error" ? "text-red-400" : "text-gray-300"}`}>{conn.lastSynced}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <span className="text-[11px] text-gray-600">{conn.users} users connected</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleTest(conn.id)}
                      disabled={isTesting}
                      className={`px-2.5 py-1 text-[11px] rounded-md transition-colors font-medium ${
                        isTesting ? "text-blue-400 bg-blue-500/10" : "text-gray-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {isTesting ? "Testing..." : "Test"}
                    </button>
                    <button className="px-2.5 py-1 text-[11px] text-amber-400 hover:text-amber-300 rounded-md hover:bg-amber-500/5 transition-colors font-medium">
                      Configure
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div className="w-full max-w-md bg-[#171717] border border-white/10 rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Add Connection</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-gray-400 mb-1">Connection Type</label>
                <select className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-[13px] text-gray-200 focus:outline-none focus:border-amber-500/30">
                  <option>PMIS (Procore, PlanGrid)</option>
                  <option>Database (PostgreSQL, MySQL)</option>
                  <option>LLM Provider (Gemini, OpenAI)</option>
                  <option>Scheduling (P6, MS Project)</option>
                  <option>Cost Management (Unifier, SAP)</option>
                  <option>Documents (SharePoint, Box)</option>
                  <option>Custom API</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-400 mb-1">Connection Name</label>
                <input type="text" placeholder="My Connection" className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-[13px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500/30" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-400 mb-1">Host / Endpoint</label>
                <input type="text" placeholder="https://api.example.com" className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-[13px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500/30 font-mono text-[12px]" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-400 mb-1">API Key / Token</label>
                <input type="password" placeholder="••••••••••••" className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-[13px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500/30" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-[13px] text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">Cancel</button>
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-[13px] font-semibold rounded-lg transition-colors">Add Connection</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
