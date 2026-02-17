'use client';

import { useUser } from '@clerk/nextjs';
import { useState, useEffect } from 'react';

export type Role = 'admin' | 'user';

export interface BuildAIUser {
  id: string;          // Clerk user ID
  email: string;
  name: string;
  role: Role;
  title: string;
  avatar: string;      // initials
  agentId?: string;    // assigned agent
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function defaultTitle(role: Role): string {
  return role === 'admin' ? 'Administrator' : 'Project Manager';
}

export function useCurrentUser(): { user: BuildAIUser | null; isLoaded: boolean } {
  const { user, isLoaded } = useUser();
  const [agentId, setAgentId] = useState<string | undefined>(undefined);
  const [agentLoaded, setAgentLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setAgentLoaded(true);
      return;
    }
    // Fetch agent assignment from admin DB (source of truth)
    fetch('/api/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.agentId) setAgentId(data.agentId);
        setAgentLoaded(true);
      })
      .catch(() => setAgentLoaded(true));
  }, [user]);

  if (!isLoaded || !agentLoaded) {
    return { user: null, isLoaded: false };
  }

  if (!user) {
    return { user: null, isLoaded: true };
  }

  const metadata = user.publicMetadata as Record<string, unknown> | undefined;
  const role: Role = (metadata?.role === 'admin' ? 'admin' : 'user');
  const title = (typeof metadata?.title === 'string' ? metadata.title : defaultTitle(role));
  // Use admin DB agentId first, fall back to Clerk metadata
  const resolvedAgentId = agentId || (typeof metadata?.agentId === 'string' ? metadata.agentId : undefined);
  const fullName = user.fullName || user.firstName || 'User';
  const email = user.primaryEmailAddress?.emailAddress || '';

  return {
    user: {
      id: user.id,
      email,
      name: fullName,
      role,
      title,
      avatar: getInitials(fullName),
      agentId: resolvedAgentId,
    },
    isLoaded: true,
  };
}
