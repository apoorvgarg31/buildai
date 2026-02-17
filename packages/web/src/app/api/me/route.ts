import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * GET /api/me — returns the current user's agent assignment from admin DB.
 * This is the source of truth for which agent a user chats with.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Dynamic import to avoid bundling better-sqlite3 in client
    const { getDb } = await import('@/lib/admin-db-server');
    const row = getDb().prepare(
      'SELECT agent_id FROM users WHERE id = ?'
    ).get(userId) as { agent_id: string | null } | undefined;

    return NextResponse.json({
      userId,
      agentId: row?.agent_id || null,
    });
  } catch (err) {
    console.error('GET /api/me error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
