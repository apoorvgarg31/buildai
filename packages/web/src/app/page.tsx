"use client";

import { useState } from "react";
import { DemoUser } from "@/lib/auth";
import LoginScreen from "@/components/LoginScreen";
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

export default function Home() {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [activePage, setActivePage] = useState<Page>("dashboard");

  if (!user) {
    return <LoginScreen onLogin={(u) => {
      setUser(u);
      setActivePage(u.role === "admin" ? "dashboard" : "chat");
    }} />;
  }

  const renderPage = () => {
    if (user.role === "admin") {
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
    }
    // User pages
    switch (activePage) {
      case "marketplace":
        return <MarketplacePage />;
      case "usage":
        return <UsagePage />;
      case "chat":
      default:
        return <ChatArea />;
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar
        user={user}
        onLogout={() => setUser(null)}
        activePage={activePage}
        onNavigate={setActivePage}
      />
      <main className="flex-1 min-w-0">
        {renderPage()}
      </main>
    </div>
  );
}
