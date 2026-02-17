"use client";

import { useState } from "react";

interface AgentRecord {
  id: string;
  name: string;
  assignedUser: string;
  model: string;
  status: "online" | "offline" | "training";
  conversations: number;
  created: string;
  skills: string[];
  description: string;
}

const demoAgents: AgentRecord[] = [
  {
    id: "1",
    name: "BuildAI Agent #1",
    assignedUser: "Mike Torres, James Wright, Carlos Mendez",
    model: "Gemini 2.0 Flash",
    status: "online",
    conversations: 1247,
    created: "Jan 15, 2025",
    skills: ["Procore Queries", "Schedule Analysis", "Cost Tracking", "RFI Drafting"],
    description: "General-purpose construction PM agent with full Procore integration.",
  },
  {
    id: "2",
    name: "BuildAI Agent #2",
    assignedUser: "Lisa Park, David Kim",
    model: "Gemini 2.0 Flash",
    status: "online",
    conversations: 834,
    created: "Feb 3, 2025",
    skills: ["Procore Queries", "Budget Analysis", "Change Orders", "Document Search"],
    description: "Specialized in budget management and change order workflows.",
  },
  {
    id: "3",
    name: "BuildAI Agent #3",
    assignedUser: "Ana Rodriguez",
    model: "Gemini 2.0 Flash",
    status: "online",
    conversations: 2103,
    created: "Jan 10, 2025",
    skills: ["Procore Queries", "Portfolio Analytics", "Risk Assessment", "Exec Reporting"],
    description: "Executive-level agent for portfolio oversight and strategic reporting.",
  },
  {
    id: "4",
    name: "BuildAI Agent #4",
    assignedUser: "Rachel Foster",
    model: "Gemini 2.0 Flash",
    status: "training",
    conversations: 156,
    created: "Mar 22, 2025",
    skills: ["Cost Tracking", "P6 Integration", "Budget Forecasting"],
    description: "Cost engineering specialist. Currently training on Unifier data.",
  },
  {
    id: "5",
    name: "BuildAI Agent #5",
    assignedUser: "Unassigned",
    model: "Gemini 2.0 Flash",
    status: "offline",
    conversations: 0,
    created: "Apr 1, 2025",
    skills: ["Procore Queries"],
    description: "New agent pending configuration and user assignment.",
  },
];

const statusConfig = {
  online: { color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400", label: "Online" },
  offline: { color: "bg-gray-500/10 text-gray-400 border-gray-500/20", dot: "bg-gray-500", label: "Offline" },
  training: { color: "bg-blue-500/10 text-blue-400 border-blue-500/20", dot: "bg-blue-400 animate-pulse", label: "Training" },
};

export default function AdminAgentsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const onlineCount = demoAgents.filter((a) => a.status === "online").length;
  const totalConversations = demoAgents.reduce((sum, a) => sum + a.conversations, 0);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 h-14 border-b border-white/5">
        <div>
          <h2 className="text-sm font-semibold text-white">AI Agents</h2>
          <p className="text-[11px] text-gray-500">{demoAgents.length} agents · {onlineCount} online · {totalConversations.toLocaleString()} total conversations</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[13px] font-semibold transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Agent
        </button>
      </header>

      {/* Agent Cards */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
          {demoAgents.map((agent) => {
            const sc = statusConfig[agent.status];
            return (
              <div key={agent.id} className="rounded-xl border border-white/5 bg-[#171717] p-5 hover:border-white/10 transition-colors">
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center text-lg">
                      🤖
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold text-white">{agent.name}</h3>
                      <p className="text-[11px] text-gray-500">{agent.model}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${sc.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                    {sc.label}
                  </span>
                </div>

                {/* Description */}
                <p className="text-[12px] text-gray-400 mb-3 leading-relaxed">{agent.description}</p>

                {/* Skills */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {agent.skills.map((skill) => (
                    <span key={skill} className="px-2 py-0.5 rounded-md bg-white/5 text-[11px] text-gray-400 border border-white/5">
                      {skill}
                    </span>
                  ))}
                </div>

                {/* Stats row */}
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[11px] text-gray-500">Assigned to</p>
                      <p className="text-[12px] text-gray-300 font-medium">{agent.assignedUser}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-gray-500">Conversations</p>
                    <p className="text-[14px] text-white font-semibold">{agent.conversations.toLocaleString()}</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                  <span className="text-[11px] text-gray-600">Created {agent.created}</span>
                  <div className="flex items-center gap-1">
                    <button className="px-2.5 py-1 text-[11px] text-gray-400 hover:text-white rounded-md hover:bg-white/5 transition-colors">
                      Configure
                    </button>
                    <button className="px-2.5 py-1 text-[11px] text-amber-400 hover:text-amber-300 rounded-md hover:bg-amber-500/5 transition-colors font-medium">
                      View Logs
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Agent Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
          <div className="w-full max-w-md bg-[#171717] border border-white/10 rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Create New Agent</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-gray-400 mb-1">Agent Name</label>
                <input type="text" placeholder="BuildAI Agent #6" className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-[13px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500/30" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-400 mb-1">Model</label>
                <select className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-[13px] text-gray-200 focus:outline-none focus:border-amber-500/30">
                  <option>Gemini 2.0 Flash</option>
                  <option>Gemini 2.0 Pro</option>
                  <option>GPT-4o</option>
                  <option>Claude 3.5 Sonnet</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-400 mb-1">Assign User</label>
                <select className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-[13px] text-gray-200 focus:outline-none focus:border-amber-500/30">
                  <option>Auto-assign later</option>
                  <option>Mike Torres</option>
                  <option>Lisa Park</option>
                  <option>James Wright</option>
                  <option>Ana Rodriguez</option>
                  <option>Rachel Foster</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-400 mb-1">Skills</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {["Procore Queries", "Schedule Analysis", "Cost Tracking", "RFI Drafting", "Document Search", "Risk Assessment"].map((skill) => (
                    <label key={skill} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0a0a0a] border border-white/10 text-[11px] text-gray-400 cursor-pointer hover:border-amber-500/30 transition-colors">
                      <input type="checkbox" className="accent-amber-500 w-3 h-3" />
                      {skill}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-[13px] text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                Cancel
              </button>
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-[13px] font-semibold rounded-lg transition-colors">
                Create Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
