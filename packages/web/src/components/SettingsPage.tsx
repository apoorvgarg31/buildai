"use client";

import { EmptyState, PageShell } from "./MiraShell";

export default function SettingsPage() {
  return (
    <PageShell
      title="Workspace settings"
      subtitle="Profile controls, notification preferences, and assistant defaults will live here in the same quiet, premium system."
      eyebrow="User settings"
    >
      <div className="mx-auto max-w-4xl">
        <EmptyState
          icon="⊙"
          title="Settings are being shaped"
          description="This surface is reserved for profile, notification, and assistant preference controls without the usual enterprise clutter."
          hint="Coming soon"
        />
      </div>
    </PageShell>
  );
}
