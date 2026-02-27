import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * GET /api/procore/status?connectionId=xxx — Check if current user has valid Procore tokens.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const connectionId = request.nextUrl.searchParams.get('connectionId');
  if (!connectionId) {
    return NextResponse.json({ error: 'connectionId is required' }, { status: 400 });
  }

  const { getDb } = await import('@/lib/admin-db-server');
  const db = getDb();

  const token = db.prepare(
    'SELECT access_token, refresh_token, expires_at FROM user_tokens WHERE user_id = ? AND connection_id = ?'
  ).get(userId, connectionId) as { access_token: string; refresh_token: string | null; expires_at: number } | undefined;

  if (!token) {
    return NextResponse.json({
      connected: false,
      authUrl: `/api/procore/auth?connectionId=${connectionId}`,
    });
  }

  const now = Math.floor(Date.now() / 1000);
  const expired = token.expires_at < now;

  return NextResponse.json({
    connected: !expired,
    expired,
    expires_in_seconds: token.expires_at - now,
    has_refresh_token: !!token.refresh_token,
    authUrl: `/api/procore/auth?connectionId=${connectionId}`,
  });
}
