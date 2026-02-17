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
  { name: "Connections", icon: "🔗", href: "/connections" },
  { name: "Usage", icon: "📊", href: "/usage" },
  { name: "Marketplace", icon: "🛍️", href: "/marketplace" },
  { name: "Settings", icon: "⚙️", href: "/settings" },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger button — only visible on small screens */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 p-2 rounded-lg bg-gray-900 text-white lg:hidden shadow-lg"
        aria-label="Open menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          flex flex-col bg-gray-900 text-gray-300 transition-all duration-200
          
          /* Mobile: fixed overlay */
          fixed inset-y-0 left-0 z-50 w-64
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          
          /* Desktop: static in layout */
          lg:relative lg:translate-x-0 lg:z-auto
          ${collapsed ? "lg:w-16" : "lg:w-64"}
        `}
      >
        {/* Logo / Brand */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              B
            </div>
            {!collapsed && (
              <div className="lg:block">
                <h1 className="text-white font-semibold text-lg leading-tight">
                  BuildAI
                </h1>
                <p className="text-xs text-gray-500">
                  Construction PM Assistant
                </p>
              </div>
            )}
          </div>
          {/* Close button on mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 text-gray-400 hover:text-white lg:hidden"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navigation.map((item) => (
            <a
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
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
            className="mt-2 w-full text-xs text-gray-500 hover:text-gray-300 transition-colors hidden lg:block"
          >
            {collapsed ? "→" : "← Collapse"}
          </button>
        </div>
      </aside>
    </>
  );
}
