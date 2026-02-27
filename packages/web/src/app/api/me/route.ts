import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';

/**
 * GET /api/me — returns the current user's role + agent assignment.
 * Auto-provisions first user as admin. Subsequent users as 'user'.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { getDb } = await import('@/lib/admin-db-server');
    const db = getDb();

    // Check if user already exists
    let row = db.prepare(
      'SELECT id, email, name, role, agent_id FROM users WHERE id = ?'
    ).get(userId) as { id: string; email: string; name: string; role: string; agent_id: string | null } | undefined;

    if (!row) {
      // Auto-provision: first user ever = admin, rest = user
      const clerkUser = await currentUser();
      const email = clerkUser?.emailAddresses?.[0]?.emailAddress || '';
      const name = clerkUser?.fullName || clerkUser?.firstName || 'User';

      const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt;
      const role = userCount === 0 ? 'admin' : 'user';

      db.prepare(
        'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)'
      ).run(userId, email, name, role);

      row = db.prepare(
        'SELECT id, email, name, role, agent_id FROM users WHERE id = ?'
      ).get(userId) as { id: string; email: string; name: string; role: string; agent_id: string | null };
    }

    return NextResponse.json({
      userId: row!.id,
      email: row!.email,
      name: row!.name,
      role: row!.role,
      agentId: row!.agent_id || null,
    });
  } catch (err) {
    console.error('GET /api/me error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
