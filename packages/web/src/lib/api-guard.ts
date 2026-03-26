import { auth } from '@clerk/nextjs/server';
import { getDb } from './admin-db-server';

export interface RequestActor {
  userId: string;
  role: 'admin' | 'user';
  agentId: string | null;
  email: string;
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

export function canAccessUser(actor: RequestActor, userId: string): boolean {
  return actor.role === 'admin' || actor.userId === userId;
}

export function assertCanAccessUser(actor: RequestActor, userId: string): void {
  if (!canAccessUser(actor, userId)) {
    throw new Error('FORBIDDEN');
  }
}

export function userHasAssignedConnection(userId: string, connectionId: string): boolean {
  const db = getDb();
  const row = db.prepare(`
    SELECT 1
    FROM users u
    JOIN agent_connections ac ON ac.agent_id = u.agent_id
    WHERE u.id = ? AND ac.connection_id = ?
    LIMIT 1
  `).get(userId, connectionId);
  return !!row;
}

export function canAccessAgent(actor: RequestActor, agentId: string): boolean {
  return actor.role === 'admin' || actor.agentId === agentId;
}

export function assertCanAccessAgent(actor: RequestActor, agentId: string): void {
  if (!canAccessAgent(actor, agentId)) {
    throw new Error('FORBIDDEN');
  }
}

export function assertCanManageAgent(actor: RequestActor, agentId: string): void {
  if (actor.role !== 'admin') {
    throw new Error('FORBIDDEN');
  }
}
