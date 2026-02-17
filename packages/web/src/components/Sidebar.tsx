"use client";

import { useState } from "react";
import { DemoUser } from "@/lib/auth";

interface NavItem {
  name: string;
  icon: string;
  href: string;
  active?: boolean;
}

const adminNav: NavItem[] = [
  { name: "Users", icon: "👥", href: "/users", active: true },
  { name: "Agents", icon: "🤖", href: "/agents" },
  { name: "Connections", icon: "🔗", href: "/connections" },
  { name: "Settings", icon: "⚙️", href: "/settings" },
];

const userNav: NavItem[] = [
  { name: "Agent", icon: "💬", href: "/", active: true },
  { name: "Marketplace", icon: "🛍️", href: "/marketplace" },
  { name: "Usage", icon: "📊", href: "/usage" },
  { name: "Settings", icon: "⚙️", href: "/settings" },
];

interface SidebarProps {
  user: DemoUser;
  onLogout: () => void;
}

export default function Sidebar({ user, onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigation = user.role === "admin" ? adminNav : userNav;

  return (
    <>
      {/* Mobile hamburger */}
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
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`
          flex flex-col bg-gray-900 text-gray-300 transition-all duration-200
          fixed inset-y-0 left-0 z-50 w-64
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:relative lg:translate-x-0 lg:z-auto
          ${collapsed ? "lg:w-16" : "lg:w-64"}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              B
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-white font-semibold text-lg leading-tight">BuildAI</h1>
                <p className="text-xs text-gray-500">
                  {user.role === "admin" ? "Admin Console" : "PM Assistant"}
                </p>
              </div>
            )}
          </div>
          <button onClick={() => setMobileOpen(false)} className="p-1 text-gray-400 hover:text-white lg:hidden">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Role badge */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-gray-800">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              user.role === "admin"
                ? "bg-purple-900/40 text-purple-400"
                : "bg-amber-900/40 text-amber-400"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${user.role === "admin" ? "bg-purple-400" : "bg-amber-400"}`} />
              {user.role === "admin" ? "Administrator" : "Project Manager"}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navigation.map((item) => (
            <a
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                item.active ? "bg-gray-800 text-white" : "hover:bg-gray-800 hover:text-white"
              }`}
            >
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.name}</span>}
            </a>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="px-3 py-3 border-t border-gray-800">
          {!collapsed ? (
            <div className="flex items-center gap-3 px-2 py-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                user.role === "admin" ? "bg-purple-600" : "bg-gray-600"
              }`}>
                {user.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                <p className="text-xs text-gray-500 truncate">{user.title}</p>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 text-gray-500 hover:text-red-400 transition-colors rounded-lg hover:bg-gray-800"
                title="Sign out"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          ) : (
            <button onClick={onLogout} className="w-full flex items-center justify-center p-2 text-gray-500 hover:text-red-400 transition-colors rounded-lg hover:bg-gray-800" title="Sign out">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
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
