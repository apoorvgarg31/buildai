"use client";

import { useState } from "react";

interface NavItem {
  name: string;
  icon: string;
  href: string;
  active?: boolean;
}

const navigation: NavItem[] = [
  { name: "Chat", icon: "💬", href: "/", active: true },
  { name: "Projects", icon: "🏗️", href: "/projects" },
  { name: "Connections", icon: "🔗", href: "/connections" },
  { name: "Documents", icon: "📄", href: "/documents" },
  { name: "Settings", icon: "⚙️", href: "/settings" },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex flex-col bg-gray-900 text-gray-300 transition-all duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-800">
        <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          B
        </div>
        {!collapsed && (
          <div>
            <h1 className="text-white font-semibold text-lg leading-tight">
              BuildAI
            </h1>
            <p className="text-xs text-gray-500">Construction PM Assistant</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navigation.map((item) => (
          <a
            key={item.name}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              item.active
                ? "bg-gray-800 text-white"
                : "hover:bg-gray-800 hover:text-white"
            }`}
          >
            <span className="text-lg flex-shrink-0">{item.icon}</span>
            {!collapsed && <span>{item.name}</span>}
          </a>
        ))}
      </nav>

      {/* Status bar */}
      <div className="px-4 py-3 border-t border-gray-800">
        {!collapsed && (
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="text-gray-400">Engine connected</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mt-2 w-full text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          {collapsed ? "→" : "← Collapse"}
        </button>
      </div>
    </aside>
  );
}
