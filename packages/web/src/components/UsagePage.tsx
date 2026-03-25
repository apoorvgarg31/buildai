"use client";

import { EmptyState, PageShell, SectionCard } from "./MiraShell";

export default function UsagePage() {
  return (
    <PageShell title="Usage intelligence" subtitle="Track how your workspace is using Mira across conversations, skills, and proactive automation." eyebrow="Analytics">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Conversations", "Live session usage and assistant activity"],
            ["Artifacts", "Generated files, outputs, and shared assets"],
            ["Automation", "Scheduled prompts and watchlist-triggered actions"],
          ].map(([title, copy]) => (
            <SectionCard key={title} className="min-h-[140px]">
              <p className="mira-eyebrow">Preview</p>
              <h3 className="mt-3 text-lg font-semibold text-slate-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
            </SectionCard>
          ))}
        </div>
        <EmptyState icon="◫" title="Usage dashboards land next" description="The visual system is in place. Data visualizations and rate breakdowns can now be dropped into a consistent Mira shell." hint="Ready for metrics wiring" />
      </div>
    </PageShell>
  );
}
