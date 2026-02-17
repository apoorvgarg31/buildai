'use client';

import { useUser } from '@clerk/nextjs';

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

  if (!isLoaded) {
    return { user: null, isLoaded: false };
  }

  if (!user) {
    return { user: null, isLoaded: true };
  }

  const metadata = user.publicMetadata as Record<string, unknown> | undefined;
  const role: Role = (metadata?.role === 'admin' ? 'admin' : 'user');
  const title = (typeof metadata?.title === 'string' ? metadata.title : defaultTitle(role));
  const agentId = typeof metadata?.agentId === 'string' ? metadata.agentId : undefined;
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
      agentId,
    },
    isLoaded: true,
  };
}
