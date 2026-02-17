"use client";

import { useState } from "react";
import { DemoUser } from "@/lib/auth";
import LoginScreen from "@/components/LoginScreen";
import Sidebar from "@/components/Sidebar";
import type { Page } from "@/components/Sidebar";
import ChatArea from "@/components/ChatArea";
import AdminDashboard from "@/components/AdminDashboard";
import MarketplacePage from "@/components/MarketplacePage";
import UsagePage from "@/components/UsagePage";

export default function Home() {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [page, setPage] = useState<Page>("chat");

  if (!user) {
    return <LoginScreen onLogin={(u) => { setUser(u); setPage(u.role === "admin" ? "users" : "chat"); }} />;
  }

  const renderPage = () => {
    if (user.role === "admin") {
      // Admin pages — currently only dashboard
      return <AdminDashboard user={user} />;
    }
    // User pages
    switch (page) {
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
        activePage={page}
        onNavigate={setPage}
      />
      <main className="flex-1 min-w-0">
        {renderPage()}
      </main>
    </div>
  );
}
