"use client";

import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { BuildAIUser } from "@/lib/user";

interface NavItem {
  name: string;
  icon: string;
  page: Page;
}

const adminNav: NavItem[] = [
  { name: "Dashboard", icon: "📊", page: "dashboard" },
  { name: "Chat", icon: "💬", page: "chat" },
  { name: "Users", icon: "👥", page: "users" },
  { name: "Agents", icon: "🤖", page: "agents" },
  { name: "Connections", icon: "🔗", page: "connections" },
  { name: "Marketplace", icon: "🛍️", page: "marketplace" },
  { name: "Settings", icon: "⚙️", page: "settings" },
];

const userNav: NavItem[] = [
  { name: "Chat", icon: "💬", page: "chat" },
  { name: "Marketplace", icon: "🛍️", page: "marketplace" },
  { name: "Usage", icon: "📊", page: "usage" },
  { name: "Settings", icon: "⚙️", page: "settings" },
];

export type UserPage = "chat" | "marketplace" | "usage" | "settings";
export type AdminPage = "dashboard" | "users" | "agents" | "connections" | "settings";
export type Page = UserPage | AdminPage;

interface SidebarProps {
  user: BuildAIUser;
  activePage?: Page;
  onNavigate?: (page: Page) => void;
}

export default function Sidebar({ user, activePage, onNavigate }: SidebarProps) {
  const { signOut } = useClerk();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigation = user.role === "admin" ? adminNav : userNav;
  const defaultPage: Page = user.role === "admin" ? "dashboard" : "chat";
  const currentPage = activePage ?? defaultPage;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#f9f9f9] text-[#171717]">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-black/5">
        <div className="w-7 h-7 rounded-full bg-[#171717] flex items-center justify-center text-white font-bold text-xs">
          B
        </div>
        <div>
          <p className="text-sm font-semibold text-[#171717] leading-none">BuildAI</p>
          <p className="text-[10px] text-[#8e8e8e] mt-0.5">
            {user.role === "admin" ? "Admin Console" : "PM Assistant"}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navigation.map((item) => (
          <button
            key={item.name}
            onClick={() => {
              onNavigate?.(item.page);
              setMobileOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
              currentPage === item.page
                ? "bg-black/[0.07] text-[#171717] font-medium"
                : "text-[#666] hover:bg-black/[0.04] hover:text-[#171717]"
            }`}
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.name}</span>
          </button>
        ))}
      </nav>

      {/* User */}
      <div className="px-2 py-3 border-t border-black/5">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-black/[0.04] transition-colors">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold ${
            user.role === "admin"
              ? "bg-gradient-to-br from-purple-500 to-purple-700"
              : "bg-gradient-to-br from-gray-500 to-gray-700"
          }`}>
            {user.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#171717] truncate">{user.name}</p>
            <p className="text-[11px] text-[#8e8e8e] truncate">{user.title}</p>
          </div>
          <button
            onClick={() => signOut({ redirectUrl: '/sign-in' })}
            className="p-1.5 text-[#8e8e8e] hover:text-[#171717] transition-colors rounded-md hover:bg-black/[0.04]"
            title="Sign out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 p-2 rounded-lg bg-white text-[#171717] lg:hidden shadow-md border border-black/10"
        aria-label="Open menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
        </div>
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[260px] transition-transform duration-200
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:relative lg:translate-x-0 lg:z-auto
      `}>
        {sidebarContent}
      </aside>
    </>
  );
}
