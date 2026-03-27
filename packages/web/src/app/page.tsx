"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/user";
import Sidebar from "@/components/Sidebar";
import type { Page } from "@/components/Sidebar";
import ChatArea from "@/components/ChatArea";
import ConnectorsPage from "@/components/ConnectorsPage";
import AdminDashboard from "@/components/AdminDashboard";
import AdminUsersPage from "@/components/AdminUsersPage";
import AdminAgentsPage from "@/components/AdminAgentsPage";
import AdminConnectionsPage from "@/components/AdminConnectionsPage";
import AdminToolsPage from "@/components/AdminToolsPage";
import AdminMcpServersPage from "@/components/AdminMcpServersPage";
import AdminSettingsPage from "@/components/AdminSettingsPage";
import MarketplacePage from "@/components/MarketplacePage";
import UsagePage from "@/components/UsagePage";
import SettingsPage from "@/components/SettingsPage";
import PersonalityStudio from "@/components/PersonalityStudio";
import WatchlistPage from "@/components/WatchlistPage";
import SchedulePage from "@/components/SchedulePage";
import ArtifactsPage from "@/components/ArtifactsPage";
import WorkspaceOnboardingPage from "@/components/WorkspaceOnboardingPage";
import { RedirectToSignIn } from "@clerk/nextjs";

export default function Home() {
  const { user, isLoaded } = useCurrentUser();
  const [mode, setMode] = useState<"user" | "admin">("user");
  const [activePage, setActivePage] = useState<Page>("chat");

  if (!isLoaded) {
    return (
      <div className="mira-app-shell flex h-full items-center justify-center">
        <div className="mira-surface rounded-[1.8rem] px-8 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#0f2746,#3b82f6)] text-sm font-semibold tracking-[0.28em] text-white">M</div>
          <p className="mt-4 text-sm text-slate-500">Loading Mira workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <RedirectToSignIn />;
  }

  if (user.needsProvisioning) {
    return (
      <div className="flex h-full overflow-hidden bg-transparent">
        <Sidebar
          user={user}
          activePage={activePage}
          onNavigate={setActivePage}
          mode={mode}
          onToggleMode={() => {
            if (user.role !== "admin") return;
            const order: Array<"user" | "admin"> = ["user", "admin"];
            const idx = order.indexOf(mode);
            const nextMode = order[(idx + 1) % order.length];
            setMode(nextMode);
            setActivePage(nextMode === "admin" ? "dashboard" : "chat");
          }}
        />
        <main className="min-w-0 flex-1 overflow-hidden">
          <WorkspaceOnboardingPage user={{ name: user.name, role: user.role }} />
        </main>
      </div>
    );
  }

  const renderPage = () => {
    if (mode === "user" || user.role !== "admin") {
      switch (activePage) {
        case "chat": return <ChatArea agentId={user.agentId} />;
        case "connectors": return <ConnectorsPage />;
        case "artifacts": return <ArtifactsPage agentId={user.agentId} />;
        case "schedule": return <SchedulePage />;
        case "watchlist": return <WatchlistPage agentId={user.agentId} />;
        case "personality": return <PersonalityStudio agentId={user.agentId} />;
        case "marketplace": return <MarketplacePage />;
        case "usage": return <UsagePage />;
        case "settings": return <SettingsPage />;
        default: return <ChatArea agentId={user.agentId} />;
      }
    }

    switch (activePage) {
      case "dashboard": return <AdminDashboard user={user} />;
      case "chat": return <ChatArea agentId={user.agentId} />;
      case "connectors": return <ConnectorsPage />;
      case "artifacts": return <ArtifactsPage agentId={user.agentId} />;
      case "users": return <AdminUsersPage />;
      case "agents": return <AdminAgentsPage />;
      case "connections": return <AdminConnectionsPage />;
      case "tools": return <AdminToolsPage />;
      case "mcp_servers": return <AdminMcpServersPage />;
      case "marketplace": return <MarketplacePage />;
      case "settings": return <AdminSettingsPage />;
      default: return <AdminDashboard user={user} />;
    }
  };

  return (
    <div className="flex h-full overflow-hidden bg-transparent">
      <Sidebar
        user={user}
        activePage={activePage}
        onNavigate={setActivePage}
        mode={mode}
        onToggleMode={() => {
          if (user.role !== "admin") return;
          const order: Array<"user" | "admin"> = ["user", "admin"];
          const idx = order.indexOf(mode);
          const nextMode = order[(idx + 1) % order.length];
          setMode(nextMode);
          setActivePage(nextMode === "admin" ? "dashboard" : "chat");
        }}
      />
      <main className="min-w-0 flex-1 overflow-hidden">{renderPage()}</main>
    </div>
  );
}
