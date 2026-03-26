"use client";

import { useEffect, useState } from "react";
import { EmptyState, PageShell, SectionCard } from "./MiraShell";

type Connector = {
  id: string;
  name: string;
  type: string;
  status: string;
  authMode: 'shared' | 'oauth_user' | 'token_user';
  userAuthorized: boolean;
  readyForUse: boolean;
  requiresUserAuth: boolean;
  authUrl?: string;
  environment?: string;
};

const authCopy: Record<Connector['authMode'], string> = {
  shared: 'Configured by your admin and ready for shared enterprise use.',
  oauth_user: 'Configured by your admin. You still need to sign in with your own account.',
  token_user: 'Available from admin, but this connector still needs your personal token.',
};

export default function ConnectorsPage() {
  const [agentId, setAgentId] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/agent/connections')
      .then((res) => res.json())
      .then((data) => {
        setAgentId(data.agentId || null);
        setConnections(data.connections || []);
      })
      .catch(() => setConnections([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageShell
      title="Connectors"
      subtitle="Authenticate the enterprise applications your admin has already configured for this workspace."
      eyebrow="User workspace"
    >
      <div className="mx-auto max-w-5xl space-y-4">
        {!agentId && !loading ? (
          <EmptyState icon="⟷" title="No agent assigned" description="Your connectors will appear here once your personal agent has been assigned." />
        ) : loading ? (
          <SectionCard><p className="text-sm text-slate-500">Loading connectors…</p></SectionCard>
        ) : connections.length === 0 ? (
          <EmptyState icon="⟷" title="No connectors available yet" description="Your admin has not assigned any connector-backed applications to this agent yet." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {connections.map((connector) => (
              <SectionCard key={connector.id} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold tracking-[-0.03em] text-slate-950">{connector.name}</h3>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{connector.type}</p>
                  </div>
                  <span className={`mira-pill ${connector.readyForUse ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {connector.readyForUse ? 'Ready' : connector.requiresUserAuth ? 'Needs sign-in' : connector.status}
                  </span>
                </div>

                <div className="mira-surface-muted rounded-[1.2rem] px-4 py-3 text-sm text-slate-600">
                  {authCopy[connector.authMode]}
                </div>

                {connector.environment ? <p className="text-xs text-slate-500">Environment: {connector.environment}</p> : null}

                <div className="flex items-center gap-2">
                  {connector.authUrl && !connector.readyForUse && connector.requiresUserAuth ? (
                    <a href={connector.authUrl} className="mira-button-primary px-4 py-2 text-xs font-semibold">
                      Connect account
                    </a>
                  ) : null}
                  {connector.authMode === 'token_user' && !connector.readyForUse ? (
                    <span className="text-xs text-slate-500">Personal token entry UI coming next.</span>
                  ) : null}
                </div>
              </SectionCard>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
