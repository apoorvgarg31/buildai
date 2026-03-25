import type { ReactNode } from "react";

interface PageShellProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageShell({ title, subtitle, eyebrow = "Mira workspace", actions, children }: PageShellProps) {
  return (
    <div className="mira-app-shell flex h-full min-h-0 flex-col overflow-hidden">
      <header className="mira-page-header shrink-0">
        <div>
          <p className="mira-eyebrow">{eyebrow}</p>
          <h1 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-2xl">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}

export function SectionCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`mira-surface rounded-[1.6rem] p-5 sm:p-6 ${className}`}>{children}</section>;
}

export function EmptyState({ icon, title, description, hint }: { icon: string; title: string; description: string; hint?: string }) {
  return (
    <div className="mira-surface flex min-h-[280px] flex-col items-center justify-center rounded-[1.8rem] px-6 py-10 text-center">
      <div className="mira-icon-chip text-2xl">{icon}</div>
      <h2 className="mt-5 text-lg font-semibold tracking-[-0.03em] text-slate-950">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      {hint ? <p className="mt-3 text-xs uppercase tracking-[0.24em] text-slate-400">{hint}</p> : null}
    </div>
  );
}
