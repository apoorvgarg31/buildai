import { auth, currentUser } from '@clerk/nextjs/server';
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

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress || '';
  const metadata = (clerkUser?.publicMetadata || {}) as Record<string, unknown>;

  const db = getDb();
  const row = db.prepare(`
    SELECT id, role, agent_id, email
    FROM users
    WHERE id = ? OR email = ?
    LIMIT 1
  `).get(userId, email) as { role?: string; agent_id?: string | null; email?: string } | undefined;

  const roleFromDb = row?.role === 'admin' ? 'admin' : row?.role === 'user' ? 'user' : undefined;
  const roleFromMetadata = metadata.role === 'admin' ? 'admin' : 'user';
  const role = roleFromDb || roleFromMetadata;

  return {
    userId,
    role,
    agentId: row?.agent_id || (typeof metadata.agentId === 'string' ? metadata.agentId : null),
    email: row?.email || email,
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
