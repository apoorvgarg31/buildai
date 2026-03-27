"use client";

import { useState } from "react";
import { PageShell, SectionCard } from "./MiraShell";

type WorkspaceOnboardingUser = {
  name: string;
  role: "admin" | "user";
};

interface WorkspaceOnboardingPageProps {
  user: WorkspaceOnboardingUser;
  onProvisioned?: (result: { agentId?: string | null }) => void;
}

const onboardingMoments = [
  {
    label: "Workspace",
    title: "Provision your personal agent",
    detail: "Mira creates an isolated workspace, memory, and runtime shell for your account before any work starts.",
  },
  {
    label: "Connectors",
    title: "Bring enterprise systems online",
    detail: "Your configured enterprise apps will appear next so you can authenticate the systems this workspace can use.",
  },
  {
    label: "Skills",
    title: "Install focused workflows",
    detail: "Once the workspace is live, you can add marketplace skills and run them safely inside your own agent boundary.",
  },
];

export default function WorkspaceOnboardingPage({ user, onProvisioned }: WorkspaceOnboardingPageProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProvision = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "PROVISION_FAILED");
      }

      if (onProvisioned) {
        onProvisioned(payload as { agentId?: string | null });
        return;
      }

      window.location.reload();
    } catch {
      setError("We could not finish provisioning your workspace. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell
      title="Welcome to Mira command"
      subtitle="A deliberate first-run flow so your workspace, connectors, and skills come online in the right order."
      eyebrow="Workspace onboarding"
      actions={
        <button
          onClick={handleProvision}
          disabled={submitting}
          className="mira-button-primary px-5 py-2.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Preparing workspace…" : "Create my workspace"}
        </button>
      }
    >
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <SectionCard className="relative overflow-hidden border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(199,230,255,0.92),rgba(255,255,255,0.95)_42%,rgba(237,244,255,0.98))]">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,39,70,0.05),transparent_46%,rgba(37,99,235,0.08))]" />
          <div className="relative">
            <div className="inline-flex items-center rounded-full border border-white/80 bg-white/80 px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500 shadow-[0_16px_42px_rgba(148,163,184,0.12)]">
              First-time access
            </div>

            <h2 className="mt-6 max-w-2xl text-[2.7rem] font-semibold leading-[0.92] tracking-[-0.08em] text-slate-950 sm:text-[3.3rem]">
              {user.name.split(" ")[0] || user.name}, your Mira workspace starts with a clean security boundary.
            </h2>

            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              {user.role === "admin"
                ? "You are the first admin in this deployment. We will provision your isolated workspace first, then hand you the controls for connectors, tools, MCP servers, and skills."
                : "We will provision your isolated workspace first, then bring in the connectors and skills your admin has already made available for you."}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {onboardingMoments.map((moment, index) => (
                <div key={moment.label} className="rounded-[1.45rem] border border-white/90 bg-white/86 p-4 shadow-[0_18px_40px_rgba(148,163,184,0.12)]">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-sky-700">0{index + 1} · {moment.label}</p>
                  <h3 className="mt-3 text-base font-semibold tracking-[-0.03em] text-slate-900">{moment.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{moment.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard className="border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,247,255,0.94))]">
          <div className="flex h-full flex-col justify-between">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-slate-400">What happens next</p>
              <div className="mt-5 space-y-4">
                <div className="rounded-[1.35rem] border border-slate-200/70 bg-white/90 p-4">
                  <p className="text-sm font-semibold text-slate-900">Isolated workspace</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">A dedicated workspace directory, memory, sessions, files, and runtime config are created for your personal agent.</p>
                </div>
                <div className="rounded-[1.35rem] border border-slate-200/70 bg-white/90 p-4">
                  <p className="text-sm font-semibold text-slate-900">Connector visibility</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Only the connector-backed applications assigned to your agent will appear in Connectors after provisioning.</p>
                </div>
                <div className="rounded-[1.35rem] border border-slate-200/70 bg-white/90 p-4">
                  <p className="text-sm font-semibold text-slate-900">Skill-ready runtime</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Marketplace installs and MCP-backed tools stay scoped to your agent workspace instead of leaking across users.</p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-slate-200/70 bg-slate-950 px-5 py-4 text-slate-50 shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-400">Security posture</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">Provisioning is explicit here so the user sees the boundary being created before chat, files, or skills become active.</p>
            </div>

            {error ? (
              <div className="mt-4 rounded-[1.2rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
