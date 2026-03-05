import { auth } from '@clerk/nextjs/server';
import { getDb } from './admin-db-server';

export interface RequestActor {
  userId: string;
  role: 'admin' | 'user';
  agentId: string | null;
  email: string;
  isSuperadmin: boolean;
}

export function isConfiguredSuperadmin(userId: string, email: string): boolean {
  const raw = process.env.BUILDAI_SUPERADMINS || '';
  const entries = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (entries.length === 0) return false;
  return entries.includes(userId.toLowerCase()) || (email ? entries.includes(email.toLowerCase()) : false);
}

export async function getRequestActor(): Promise<RequestActor | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const db = getDb();
  const row = db.prepare(`
    SELECT id, role, agent_id, email
    FROM users
    WHERE id = ?
    LIMIT 1
  `).get(userId) as { id: string; role?: string; agent_id?: string | null; email?: string } | undefined;

  if (!row) return null;

  const email = row.email || '';
  return {
    userId,
    role: row.role === 'admin' ? 'admin' : 'user',
    agentId: row.agent_id || null,
    email,
    isSuperadmin: isConfiguredSuperadmin(userId, email),
  };
}

export async function requireSignedIn(): Promise<RequestActor> {
  const actor = await getRequestActor();
  if (!actor) {
    throw new Error('UNAUTHENTICATED');
  }
  return actor;
}

export async function requireAdmin(): Promise<RequestActor> {
  const actor = await requireSignedIn();
  if (actor.role !== 'admin') {
    throw new Error('FORBIDDEN');
  }
  return actor;
}

export async function requireSuperadmin(): Promise<RequestActor> {
  const actor = await requireSignedIn();
  const configured = (process.env.BUILDAI_SUPERADMINS || '').trim().length > 0;
  // Backward-compatible default for fresh local setups: admin acts as superadmin
  // until explicit superadmin list is configured.
  if (!configured && actor.role === 'admin') {
    return { ...actor, isSuperadmin: true };
  }
  if (!actor.isSuperadmin) {
    throw new Error('FORBIDDEN_SUPERADMIN');
  }
  return actor;
}

export function canAccessAgent(actor: RequestActor, agentId: string): boolean {
  return actor.role === 'admin' || actor.agentId === agentId;
}
