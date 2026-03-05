"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/user";
import Sidebar from "@/components/Sidebar";
import type { Page } from "@/components/Sidebar";
import ChatArea from "@/components/ChatArea";
import AdminDashboard from "@/components/AdminDashboard";
import AdminUsersPage from "@/components/AdminUsersPage";
import AdminAgentsPage from "@/components/AdminAgentsPage";
import AdminConnectionsPage from "@/components/AdminConnectionsPage";
import AdminSettingsPage from "@/components/AdminSettingsPage";
import MarketplacePage from "@/components/MarketplacePage";
import UsagePage from "@/components/UsagePage";
import SettingsPage from "@/components/SettingsPage";
import PersonalityStudio from "@/components/PersonalityStudio";
import WatchlistPage from "@/components/WatchlistPage";
import SchedulePage from "@/components/SchedulePage";
import ArtifactsPage from "@/components/ArtifactsPage";
import SuperadminOrgsPage from "@/components/SuperadminOrgsPage";

export default function Home() {
  const { user, isLoaded } = useCurrentUser();
  const [mode, setMode] = useState<"user" | "admin" | "superadmin">("user");
  const [activePage, setActivePage] = useState<Page>("chat");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-[#171717] flex items-center justify-center text-white text-sm font-bold mx-auto animate-pulse">
            B
          </div>
          <p className="text-sm text-[#8e8e8e]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Clerk middleware should redirect to /sign-in, but just in case:
    return null;
  }

  const renderPage = () => {
    if (mode === "superadmin" && user.isSuperadmin) {
      switch (activePage) {
        case "orgs":
          return <SuperadminOrgsPage />;
        case "users":
          return <AdminUsersPage />;
        case "settings":
          return <AdminSettingsPage />;
        default:
          return <SuperadminOrgsPage />;
      }
    }

    // User mode pages (admins can use these too)
    if (mode === "user" || user.role !== "admin") {
      switch (activePage) {
        case "chat":
          return <ChatArea agentId={user.agentId} />;
        case "artifacts":
          return <ArtifactsPage agentId={user.agentId} />;
        case "schedule":
          return <SchedulePage />;
        case "watchlist":
          return <WatchlistPage agentId={user.agentId} />;
        case "personality":
          return <PersonalityStudio agentId={user.agentId} />;
        case "marketplace":
          return <MarketplacePage />;
        case "usage":
          return <UsagePage />;
        case "settings":
          return <SettingsPage />;
        default:
          return <ChatArea agentId={user.agentId} />;
      }
    }

    // Admin mode pages
    switch (activePage) {
      case "dashboard":
        return <AdminDashboard user={user} />;
      case "users":
        return <AdminUsersPage />;
      case "agents":
        return <AdminAgentsPage />;
      case "connections":
        return <AdminConnectionsPage />;
      case "settings":
        return <AdminSettingsPage />;
      default:
        return <AdminDashboard user={user} />;
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar
        user={user}
        activePage={activePage}
        onNavigate={setActivePage}
        mode={mode}
        onToggleMode={() => {
          const hasAdmin = user.role === "admin";
          const hasSuper = !!user.isSuperadmin;
          if (!hasAdmin && !hasSuper) return;

          const order: Array<"user" | "admin" | "superadmin"> = hasSuper
            ? (hasAdmin ? ["user", "admin", "superadmin"] : ["user", "superadmin"])
            : ["user", "admin"];

          const idx = order.indexOf(mode);
          const nextMode = order[(idx + 1) % order.length];
          setMode(nextMode);
          setActivePage(nextMode === "admin" ? "dashboard" : nextMode === "superadmin" ? "orgs" : "chat");
        }}
      />
      <main className="flex-1 min-w-0">
        {renderPage()}
      </main>
    </div>
  );
}
