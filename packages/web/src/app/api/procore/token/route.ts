import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * GET /api/procore/token?connectionId=xxx — Returns the current user's Procore access token.
 * Called by the engine skill to make API calls on behalf of the user.
 * Auto-refreshes expired tokens using the refresh_token.
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

  // Get user's token
  const token = db.prepare(
    'SELECT access_token, refresh_token, token_type, expires_at FROM user_tokens WHERE user_id = ? AND connection_id = ?'
  ).get(userId, connectionId) as {
    access_token: string;
    refresh_token: string | null;
    token_type: string;
    expires_at: number;
  } | undefined;

  if (!token) {
    return NextResponse.json({
      authorized: false,
      authUrl: `/api/procore/auth?connectionId=${connectionId}`,
      message: 'User has not authorized Procore access. Please visit the auth URL to connect.',
    }, { status: 200 });
  }

  const now = Math.floor(Date.now() / 1000);

  // If token is expired, try to refresh
  if (token.expires_at < now && token.refresh_token) {
    const conn = db.prepare('SELECT config FROM connections WHERE id = ?').get(connectionId) as { config: string } | undefined;
    if (!conn) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    const config = JSON.parse(conn.config);
    const clientId = config.clientId;
    const clientSecret = config.clientSecret;
    const baseUrl = config.oauthBaseUrl || 'https://login.procore.com';

    if (!clientId || !clientSecret) {
      return NextResponse.json({
        authorized: false,
        expired: true,
        authUrl: `/api/procore/auth?connectionId=${connectionId}`,
        message: 'Token expired and connection missing credentials for refresh.',
      });
    }

    try {
      const refreshRes = await fetch(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: token.refresh_token,
        }),
      });

      const refreshData = await refreshRes.json();

      if (refreshData.error || !refreshData.access_token) {
        return NextResponse.json({
          authorized: false,
          expired: true,
          authUrl: `/api/procore/auth?connectionId=${connectionId}`,
          message: 'Token expired and refresh failed. Please re-authorize.',
        });
      }

      const newExpiresAt = Math.floor(Date.now() / 1000) + (refreshData.expires_in || 7200);
      db.prepare(`
        UPDATE user_tokens SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = datetime('now')
        WHERE user_id = ? AND connection_id = ?
      `).run(
        refreshData.access_token,
        refreshData.refresh_token || token.refresh_token,
        newExpiresAt,
        userId,
        connectionId,
      );

      return NextResponse.json({
        authorized: true,
        access_token: refreshData.access_token,
        token_type: refreshData.token_type || 'Bearer',
        expires_in: refreshData.expires_in || 7200,
      });
    } catch (err) {
      return NextResponse.json({
        authorized: false,
        expired: true,
        authUrl: `/api/procore/auth?connectionId=${connectionId}`,
        message: `Token refresh error: ${err instanceof Error ? err.message : 'unknown'}`,
      });
    }
  }

  if (token.expires_at < now) {
    return NextResponse.json({
      authorized: false,
      expired: true,
      authUrl: `/api/procore/auth?connectionId=${connectionId}`,
      message: 'Token expired. Please re-authorize.',
    });
  }

  return NextResponse.json({
    authorized: true,
    access_token: token.access_token,
    token_type: token.token_type || 'Bearer',
    expires_in: token.expires_at - now,
  });
}
