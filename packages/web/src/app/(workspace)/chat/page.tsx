"use client";

import ChatArea from "@/components/ChatArea";
import { useCurrentUser } from "@/lib/user";

export default function ChatRoutePage() {
  const { user } = useCurrentUser();
  return <ChatArea agentId={user?.agentId} />;
}
