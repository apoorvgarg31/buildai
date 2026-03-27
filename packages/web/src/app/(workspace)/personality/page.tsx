"use client";

import PersonalityStudio from "@/components/PersonalityStudio";
import { useCurrentUser } from "@/lib/user";

export default function PersonalityRoutePage() {
  const { user } = useCurrentUser();
  return <PersonalityStudio agentId={user?.agentId} />;
}
