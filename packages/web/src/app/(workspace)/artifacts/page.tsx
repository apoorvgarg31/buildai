"use client";

import ArtifactsPage from "@/components/ArtifactsPage";
import { useCurrentUser } from "@/lib/user";

export default function ArtifactsRoutePage() {
  const { user } = useCurrentUser();
  return <ArtifactsPage agentId={user?.agentId} />;
}
