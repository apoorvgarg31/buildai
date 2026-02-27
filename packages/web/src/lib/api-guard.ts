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

  return {
    userId,
    role: row.role === 'admin' ? 'admin' : 'user',
    agentId: row.agent_id || null,
    email: row.email || '',
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

export function canAccessAgent(actor: RequestActor, agentId: string): boolean {
  return actor.role === 'admin' || actor.agentId === agentId;
}
