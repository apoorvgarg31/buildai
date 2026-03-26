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
  { name: "Dashboard", icon: "◫", page: "dashboard" },
  { name: "Chat", icon: "◎", page: "chat" },
  { name: "Artifacts", icon: "◨", page: "artifacts" },
  { name: "Users", icon: "◌", page: "users" },
  { name: "Agents", icon: "✦", page: "agents" },
  { name: "Connections", icon: "⟷", page: "connections" },
  { name: "Marketplace", icon: "◇", page: "marketplace" },
  { name: "Settings", icon: "⊙", page: "settings" },
];

const userNav: NavItem[] = [
  { name: "Chat", icon: "◎", page: "chat" },
  { name: "Artifacts", icon: "◨", page: "artifacts" },
  { name: "Automation", icon: "◷", page: "schedule" },
  { name: "Watchlist", icon: "◔", page: "watchlist" },
  { name: "Personality", icon: "✦", page: "personality" },
  { name: "Marketplace", icon: "◇", page: "marketplace" },
  { name: "Usage", icon: "◫", page: "usage" },
  { name: "Settings", icon: "⊙", page: "settings" },
];

export type UserPage = "chat" | "artifacts" | "schedule" | "watchlist" | "personality" | "marketplace" | "usage" | "settings";
export type AdminPage = "dashboard" | "users" | "agents" | "connections";
export type Page = UserPage | AdminPage;

interface SidebarProps {
  user: BuildAIUser;
  activePage?: Page;
  onNavigate?: (page: Page) => void;
  mode?: "user" | "admin";
  onToggleMode?: () => void;
}

export default function Sidebar({ user, activePage, onNavigate, mode = "user", onToggleMode }: SidebarProps) {
  const { signOut } = useClerk();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdminView = user.role === "admin" && mode === "admin";
  const navigation = isAdminView ? adminNav : userNav;
  const defaultPage: Page = isAdminView ? "dashboard" : "chat";
  const currentPage = activePage ?? defaultPage;
  const modeLabel = isAdminView ? "Admin operations" : "Project workspace";

  const sidebarContent = (
    <div className="flex h-full flex-col border-r border-slate-200/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(243,248,255,0.72))] text-slate-900 backdrop-blur-2xl">
      <div className="border-b border-slate-200/60 px-4 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#0f2746,#3b82f6)] text-sm font-semibold tracking-[0.28em] text-white shadow-[0_18px_32px_rgba(59,130,246,0.24)]">
            M
          </div>
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-slate-400">Mira</p>
            <p className="text-sm font-semibold text-slate-950">Mira command</p>
          </div>
        </div>
        <div className="mira-surface-muted mt-4 rounded-[1.2rem] px-3 py-3">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-400">Current mode</p>
          <p className="mt-2 text-sm font-medium text-slate-900">{modeLabel}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Calm, premium workflows across user and admin operations.</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const active = currentPage === item.page;
          return (
            <button
              key={item.name}
              onClick={() => {
                onNavigate?.(item.page);
                setMobileOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-[1.05rem] px-3 py-3 text-sm transition-all ${
                active
                  ? "bg-[linear-gradient(135deg,rgba(18,49,88,0.96),rgba(53,111,196,0.96))] text-white shadow-[0_18px_32px_rgba(37,84,141,0.18)]"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
              }`}
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-sm ${active ? "bg-white/12 text-white" : "bg-slate-100 text-slate-600"}`}>{item.icon}</span>
              <span className="font-medium">{item.name}</span>
            </button>
          );
        })}
      </nav>

      {user.role === "admin" && (
        <div className="px-3 pb-3">
          <button onClick={onToggleMode} className="mira-surface-muted flex w-full items-center justify-between rounded-[1.1rem] px-3 py-3 text-left">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">View switcher</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{isAdminView ? "Admin" : "User"}</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">Switch</span>
          </button>
        </div>
      )}

      <div className="border-t border-slate-200/60 px-3 py-4">
        <div className="mira-surface-muted flex items-center gap-3 rounded-[1.2rem] px-3 py-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-semibold text-white ${user.role === "admin" ? "bg-[linear-gradient(145deg,#4f46e5,#7c3aed)]" : "bg-[linear-gradient(145deg,#0f2746,#3b82f6)]"}`}>
            {user.avatar}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-950">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.title}</p>
          </div>
          <button
            onClick={() => signOut({ redirectUrl: "/sign-in" })}
            className="rounded-xl border border-slate-200 bg-white/80 p-2 text-slate-500 transition hover:text-slate-900"
            title="Sign out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-50 rounded-2xl border border-slate-200 bg-white/90 p-2.5 text-slate-700 shadow-[0_12px_30px_rgba(148,163,184,0.2)] backdrop-blur lg:hidden"
        aria-label="Open menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {mobileOpen && <div className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 w-[284px] transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:relative lg:translate-x-0 lg:z-auto`}>
        {sidebarContent}
      </aside>
    </>
  );
}
