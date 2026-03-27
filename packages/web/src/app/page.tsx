"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/user";
import Sidebar from "@/components/Sidebar";
import WorkspaceOnboardingPage from "@/components/WorkspaceOnboardingPage";
import { RedirectToSignIn } from "@clerk/nextjs";

export default function Home() {
  const { user, isLoaded } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded || !user || user.needsProvisioning) return;
    router.replace(user.role === "admin" ? "/chat" : "/chat");
  }, [isLoaded, router, user]);

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
        <Sidebar user={user} />
        <main className="min-w-0 flex-1 overflow-hidden">
          <WorkspaceOnboardingPage user={{ name: user.name, role: user.role }} />
        </main>
      </div>
    );
  }

  return (
    <div className="mira-app-shell flex h-full items-center justify-center">
      <div className="mira-surface rounded-[1.8rem] px-8 py-10 text-center">
        <div className="mx-auto flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#0f2746,#3b82f6)] text-sm font-semibold tracking-[0.28em] text-white">M</div>
        <p className="mt-4 text-sm text-slate-500">Opening your workspace…</p>
      </div>
    </div>
  );
}
