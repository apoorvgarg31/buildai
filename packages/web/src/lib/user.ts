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
  needsProvisioning: boolean;
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
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const [meData, setMeData] = useState<{
    userId: string;
    email: string;
    name: string;
    role: Role;
    agentId: string | null;
    needsProvisioning: boolean;
  } | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);

  useEffect(() => {
    if (!clerkUser) {
      setMeLoaded(true);
      return;
    }

    fetch('/api/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setMeData({
            userId: data.userId,
            email: data.email || clerkUser.primaryEmailAddress?.emailAddress || '',
            name: data.name || clerkUser.fullName || clerkUser.firstName || 'User',
            role: data.role === 'admin' ? 'admin' : 'user',
            agentId: data.agentId || null,
            needsProvisioning: !!data.needsProvisioning,
          });
        }
        setMeLoaded(true);
      })
      .catch(() => setMeLoaded(true));
  }, [clerkUser]);

  if (!clerkLoaded || (clerkUser && !meLoaded)) {
    return { user: null, isLoaded: false };
  }

  if (!clerkUser || !meData) {
    return { user: null, isLoaded: true };
  }

  const metadata = clerkUser.publicMetadata as Record<string, unknown> | undefined;
  const title = (typeof metadata?.title === 'string' ? metadata.title : defaultTitle(meData.role));

  return {
    user: {
      id: meData.userId,
      email: meData.email,
      name: meData.name,
      role: meData.role,
      title,
      avatar: getInitials(meData.name),
      agentId: meData.agentId || undefined,
      needsProvisioning: meData.needsProvisioning,
    },
    isLoaded: true,
  };
}
