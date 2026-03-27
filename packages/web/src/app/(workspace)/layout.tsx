"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RedirectToSignIn } from "@clerk/nextjs";
import Sidebar from "@/components/Sidebar";
import { useCurrentUser } from "@/lib/user";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useCurrentUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded || !user) return;
    if (user.needsProvisioning) {
      router.replace("/");
      return;
    }
    if (pathname.startsWith("/admin") && user.role !== "admin") {
      router.replace("/chat");
    }
  }, [isLoaded, pathname, router, user]);

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
    return null;
  }

  return (
    <div className="flex h-full overflow-hidden bg-transparent">
      <Sidebar user={user} />
      <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
