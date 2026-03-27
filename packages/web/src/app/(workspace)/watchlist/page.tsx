"use client";

import WatchlistPage from "@/components/WatchlistPage";
import { useCurrentUser } from "@/lib/user";

export default function WatchlistRoutePage() {
  const { user } = useCurrentUser();
  return <WatchlistPage agentId={user?.agentId} />;
}
