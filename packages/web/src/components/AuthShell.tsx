"use client";

import type { ReactNode } from "react";

interface AuthShellProps {
  mode: "sign-in" | "sign-up";
  children: ReactNode;
}

const copy = {
  "sign-in": {
    eyebrow: "Mira for modern project teams",
    title: "Mira gets it done.",
    subtitle: "Keeps complex projects clear, calm, and moving.",
    ctaLabel: "New here? Create account",
    ctaHref: "/sign-up",
    formTitle: "Sign in",
    formSubtitle: "Step into your Mira workspace.",
  },
  "sign-up": {
    eyebrow: "Mira for modern project teams",
    title: "Mira gets teams moving.",
    subtitle: "A cleaner operating layer for project delivery, decisions, and follow-through.",
    ctaLabel: "Already have access? Sign in",
    ctaHref: "/sign-in",
    formTitle: "Create account",
    formSubtitle: "Set up your Mira workspace.",
  },
};

const pillars = [
  {
    title: "Clear ownership",
    text: "Know what needs action.",
  },
  {
    title: "Less noise",
    text: "See only what matters.",
  },
  {
    title: "Better follow-through",
    text: "Keep work moving.",
  },
];

export default function AuthShell({ mode, children }: AuthShellProps) {
  const content = copy[mode];

  return (
    <div className="mira-auth-shell mira-light-shell min-h-screen overflow-hidden text-slate-900">
      <div className="mira-auth-noise pointer-events-none absolute inset-0 opacity-50" />
      <div className="mira-orb mira-orb-a" />
      <div className="mira-orb mira-orb-b" />
      <div className="mira-grid pointer-events-none absolute inset-0 opacity-[0.28]" />
      <div className="mira-beam mira-beam-a" />
      <div className="mira-beam mira-beam-b" />
      <div className="mira-beam mira-beam-c" />

      <div className="relative mx-auto flex min-h-screen max-w-[1520px] flex-col px-5 py-6 sm:px-8 lg:px-10">
        <main className="relative flex flex-1 items-center py-6 lg:py-10">
          <div className="grid w-full gap-8 lg:grid-cols-[1.16fr_0.84fr] lg:gap-10 xl:gap-14">
            <section className="relative overflow-hidden rounded-[2.25rem] border border-[#dce9f7] bg-white/74 p-6 shadow-[0_34px_120px_rgba(158,190,226,0.16)] backdrop-blur-2xl sm:p-8 lg:p-10 xl:p-12">
              <div className="mira-panel-glow pointer-events-none absolute inset-0" />
              <div className="relative max-w-[780px]">
                <div className="inline-flex items-center gap-3 rounded-full border border-[#dbe8f6] bg-white/72 px-4 py-2 shadow-[0_14px_40px_rgba(173,201,232,0.16)]">
                  <div className="mira-logo-ring flex h-10 w-10 items-center justify-center rounded-2xl border border-[#d8e6f8] bg-[linear-gradient(180deg,#ffffff,#edf5ff)] text-sm font-semibold tracking-[0.28em] text-slate-700 shadow-[0_10px_30px_rgba(113,163,227,0.14)]">
                    M
                  </div>
                  <p className="text-sm font-medium tracking-[-0.02em] text-slate-700">Mira</p>
                </div>

                <div className="mt-8 inline-flex items-center rounded-full border border-[#dbe8f6] bg-white/76 px-4 py-2 text-xs font-medium text-slate-500 shadow-[0_10px_28px_rgba(173,201,232,0.12)]">
                  {content.eyebrow}
                </div>

                <h1 className="mira-headline mt-6 text-[3.2rem] font-semibold leading-[0.94] text-slate-800 sm:text-[4.2rem] xl:text-[5rem] xl:whitespace-nowrap">
                  {content.title}
                </h1>

                <p className="mt-5 max-w-lg text-base leading-8 text-slate-500 sm:text-lg">{content.subtitle}</p>

                <div className="mt-4 h-px w-32 bg-[linear-gradient(90deg,rgba(125,189,245,0.0),rgba(125,189,245,0.8),rgba(125,189,245,0.0))]" />

                <div className="mt-4 inline-flex items-center rounded-full border border-[#dbe8f6] bg-white/76 px-4 py-2 text-xs font-medium text-slate-500 shadow-[0_10px_28px_rgba(173,201,232,0.12)]">
                  Less noise. Better follow-through.
                </div>

                <div className="mira-flow mt-12 space-y-4">
                  {pillars.map((item, index) => (
                    <div
                      key={item.title}
                      className={`mira-flow-row flex items-center gap-4 rounded-[1.6rem] border border-[#deebf7] bg-white/72 px-4 py-4 shadow-[0_18px_44px_rgba(168,193,222,0.12)] ${index === 1 ? "sm:ml-8" : ""} ${index === 2 ? "sm:ml-16" : ""}`}
                      style={{ animationDelay: `${index * 140}ms` }}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#d8e6f8] bg-[linear-gradient(180deg,#ffffff,#edf6ff)] text-sm font-semibold text-slate-700 shadow-[0_10px_24px_rgba(113,163,227,0.12)]">
                        0{index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-semibold tracking-[-0.02em] text-slate-800">{item.title}</div>
                        <div className="mt-1 text-sm text-slate-500">{item.text}</div>
                      </div>
                      <div className="hidden h-px w-20 bg-[linear-gradient(90deg,rgba(122,191,255,0.06),rgba(122,191,255,0.7),rgba(122,191,255,0.06))] sm:block" />
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="relative flex items-center justify-center">
              <div className="mira-form-frame relative w-full max-w-[500px] overflow-hidden rounded-[2.25rem] border border-[#dce9f7] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,249,255,0.88))] p-[1px] shadow-[0_32px_90px_rgba(170,196,225,0.22)]">
                <div className="relative overflow-hidden rounded-[calc(2.25rem-1px)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(241,247,255,0.92))] px-6 py-6 sm:px-7 sm:py-7">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(129,185,255,0.16),transparent_42%)]" />
                  <div className="relative">
                    <div className="mb-7 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[0.7rem] uppercase tracking-[0.28em] text-slate-400">Mira access</p>
                        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-800">{content.formTitle}</h2>
                        <p className="mt-2 text-sm leading-7 text-slate-500">{content.formSubtitle}</p>
                      </div>
                      <div className="mira-cube hidden h-20 w-20 shrink-0 rounded-[1.7rem] border border-[#dbeaf8] bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.95),rgba(208,236,255,0.7)_40%,rgba(231,242,255,0.82)_75%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_20px_40px_rgba(145,188,233,0.18)] sm:block" />
                    </div>
                    {children}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
