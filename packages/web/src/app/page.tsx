"use client";

import { useState } from "react";
import { DemoUser } from "@/lib/auth";
import LoginScreen from "@/components/LoginScreen";
import Sidebar from "@/components/Sidebar";
import ChatArea from "@/components/ChatArea";
import AdminDashboard from "@/components/AdminDashboard";

export default function Home() {
  const [user, setUser] = useState<DemoUser | null>(null);

  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar user={user} onLogout={() => setUser(null)} />
      <main className="flex-1 min-w-0">
        {user.role === "admin" ? (
          <AdminDashboard user={user} />
        ) : (
          <ChatArea />
        )}
      </main>
    </div>
  );
}
