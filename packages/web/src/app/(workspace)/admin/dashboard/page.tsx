"use client";

import AdminDashboard from "@/components/AdminDashboard";
import { useCurrentUser } from "@/lib/user";

export default function AdminDashboardRoutePage() {
  const { user } = useCurrentUser();
  if (!user) return null;
  return <AdminDashboard user={user} />;
}
