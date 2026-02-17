"use client";

/* ── Demo data ── */

const statsRow = [
  { label: "Total Queries", value: "2,847", icon: "💬", detail: "This month", color: "from-blue-500/10 to-blue-600/5 border-blue-500/10" },
  { label: "Tokens Used", value: "1.2M", icon: "🔤", detail: "≈ 480K in / 720K out", color: "from-purple-500/10 to-purple-600/5 border-purple-500/10" },
  { label: "Cost This Month", value: "$18.40", icon: "💰", detail: "Avg $0.006/query", color: "from-amber-500/10 to-amber-600/5 border-amber-500/10" },
  { label: "Avg Response", value: "1.8s", icon: "⚡", detail: "P95: 3.2s", color: "from-emerald-500/10 to-emerald-600/5 border-emerald-500/10" },
];

const last7Days = [
  { day: "Mon", queries: 380, label: "Mon" },
  { day: "Tue", queries: 420, label: "Tue" },
  { day: "Wed", queries: 510, label: "Wed" },
  { day: "Thu", queries: 470, label: "Thu" },
  { day: "Fri", queries: 390, label: "Fri" },
  { day: "Sat", queries: 180, label: "Sat" },
  { day: "Sun", queries: 120, label: "Sun" },
];

const maxQueries = Math.max(...last7Days.map((d) => d.queries));

const recentQueries = [
  { time: "2 min ago", question: "What's the current budget variance on the Riverside Tower project?", responseTime: "1.4s", category: "Budget" },
  { time: "8 min ago", question: "List all open RFIs for the Downtown Parking Garage", responseTime: "2.1s", category: "RFIs" },
  { time: "15 min ago", question: "Show me the critical path for Phase 2 construction schedule", responseTime: "1.9s", category: "Schedule" },
  { time: "22 min ago", question: "What safety incidents were reported this week?", responseTime: "1.2s", category: "Documents" },
  { time: "31 min ago", question: "Compare actual vs planned spend on concrete for Building A", responseTime: "2.8s", category: "Budget" },
  { time: "45 min ago", question: "Who submitted RFI-2847 and what's the status?", responseTime: "1.1s", category: "RFIs" },
  { time: "1h ago", question: "Pull the latest daily log from the Procore Highway 101 project", responseTime: "1.6s", category: "Documents" },
  { time: "1h ago", question: "What's the float on the HVAC installation activity?", responseTime: "2.3s", category: "Schedule" },
  { time: "2h ago", question: "Generate a cost forecast for Q2 based on current burn rate", responseTime: "3.1s", category: "Budget" },
  { time: "2h ago", question: "Summarize change order CO-142 impact on schedule", responseTime: "1.7s", category: "RFIs" },
];

const categoryBreakdown = [
  { name: "RFIs", pct: 35, color: "bg-amber-400" },
  { name: "Budget", pct: 25, color: "bg-blue-400" },
  { name: "Schedule", pct: 20, color: "bg-emerald-400" },
  { name: "Documents", pct: 15, color: "bg-purple-400" },
  { name: "Other", pct: 5, color: "bg-gray-500" },
];

const categoryTagColor: Record<string, string> = {
  RFIs: "text-amber-400 bg-amber-500/10",
  Budget: "text-blue-400 bg-blue-500/10",
  Schedule: "text-emerald-400 bg-emerald-500/10",
  Documents: "text-purple-400 bg-purple-500/10",
  Other: "text-gray-400 bg-white/5",
};

/* ── Component ── */

export default function UsagePage() {
  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 h-14 border-b border-white/5 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-white">Usage</h2>
          <p className="text-[11px] text-gray-500">Analytics &amp; query history</p>
        </div>
        <span className="text-[11px] text-gray-500 bg-white/5 px-2.5 py-1 rounded-full">
          June 2025
        </span>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {statsRow.map((stat) => (
              <div
                key={stat.label}
                className={`rounded-xl border bg-gradient-to-br ${stat.color} p-4`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">{stat.icon}</span>
                </div>
                <p className="text-2xl font-bold text-white mt-2">{stat.value}</p>
                <p className="text-[12px] text-gray-400 mt-0.5">{stat.label}</p>
                <p className="text-[10px] text-gray-500 mt-1">{stat.detail}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Bar chart — queries per day */}
            <div className="lg:col-span-2 rounded-xl border border-white/5 bg-[#171717] p-4">
              <h3 className="text-sm font-semibold text-white mb-4">
                Queries — Last 7 Days
              </h3>
              <div className="flex items-end gap-3 h-44">
                {last7Days.map((d) => {
                  const pct = (d.queries / maxQueries) * 100;
                  return (
                    <div
                      key={d.day}
                      className="flex-1 flex flex-col items-center gap-2"
                    >
                      <span className="text-[10px] text-gray-400 font-medium">
                        {d.queries}
                      </span>
                      <div className="w-full flex justify-center">
                        <div
                          className="w-full max-w-[40px] rounded-t-md bg-gradient-to-t from-amber-500 to-amber-400 transition-all duration-500"
                          style={{ height: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-gray-500 font-medium">
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Category breakdown */}
            <div className="rounded-xl border border-white/5 bg-[#171717] p-4">
              <h3 className="text-sm font-semibold text-white mb-4">
                By Category
              </h3>
              <div className="space-y-3">
                {categoryBreakdown.map((cat) => (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] text-gray-300 font-medium">
                        {cat.name}
                      </span>
                      <span className="text-[12px] text-gray-500">
                        {cat.pct}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cat.color} transition-all duration-700`}
                        style={{ width: `${cat.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Model info */}
              <div className="mt-6 pt-4 border-t border-white/5">
                <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-2">
                  Model
                </p>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-[13px] text-white font-medium">
                    Gemini 2.0 Flash
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-gray-500 space-y-0.5">
                  <p>Input: $0.10 / 1M tokens</p>
                  <p>Output: $0.40 / 1M tokens</p>
                  <p>Context: 1M tokens</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent queries */}
          <div className="rounded-xl border border-white/5 bg-[#171717] p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">
                Recent Queries
              </h3>
              <span className="text-[11px] text-gray-500">Last 10</span>
            </div>
            <div className="space-y-1">
              {recentQueries.map((q, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 py-2.5 px-3 rounded-lg hover:bg-white/[0.03] transition-colors"
                >
                  <span className="text-[11px] text-gray-600 w-16 shrink-0 text-right">
                    {q.time}
                  </span>
                  <p className="text-[13px] text-gray-300 flex-1 min-w-0 truncate">
                    {q.question}
                  </p>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                      categoryTagColor[q.category] ?? categoryTagColor.Other
                    }`}
                  >
                    {q.category}
                  </span>
                  <span className="text-[11px] text-gray-500 shrink-0 w-10 text-right">
                    {q.responseTime}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
