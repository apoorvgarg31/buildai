import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getConnection } from '@/lib/admin-db';
import { userHasAssignedConnection } from '@/lib/api-guard';
import { getConnectorAuthUrl, parseConnectorTokenResponse, refreshConnectorTokenRequest } from '@/lib/connector-oauth';

type TokenStatusResponse = {
  authorized: boolean;
  expired?: boolean;
  authUrl?: string;
  message?: string;
  token_type?: string;
  expires_in?: number;
  refreshed?: boolean;
};

function tokenStatus(body: TokenStatusResponse, status = 200) {
  return NextResponse.json(body, { status });
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const connectionId = request.nextUrl.searchParams.get('connectionId');
  if (!connectionId) {
    return NextResponse.json({ error: 'connectionId is required' }, { status: 400 });
  }
  if (!userHasAssignedConnection(userId, connectionId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const conn = getConnection(connectionId);
  if (!conn) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }
  if (conn.auth_mode !== 'oauth_user') {
    return NextResponse.json({ error: 'Connection does not support user OAuth' }, { status: 400 });
  }

  const { getDb } = await import('@/lib/admin-db-server');
  const db = getDb();
  const token = db.prepare(
    'SELECT access_token, refresh_token, token_type, expires_at FROM user_tokens WHERE user_id = ? AND connection_id = ?'
  ).get(userId, connectionId) as {
    access_token: string;
    refresh_token: string | null;
    token_type: string;
    expires_at: number | null;
  } | undefined;

  if (!token) {
    return tokenStatus({
      authorized: false,
      authUrl: getConnectorAuthUrl(conn.type, connectionId),
      message: 'User has not authorized this connector yet.',
    });
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = token.expires_at || null;
  if (expiresAt && expiresAt < now && token.refresh_token) {
    try {
      const refresh = refreshConnectorTokenRequest(connectionId, token.refresh_token, request.nextUrl.origin);
      const refreshRes = await fetch(refresh.url, refresh.init);
      const refreshData = await refreshRes.json();
      if ((refreshData && typeof refreshData === 'object' && 'error' in refreshData) || !refreshRes.ok) {
        const message = refreshData?.error_description || refreshData?.error || `HTTP ${refreshRes.status}`;
        return tokenStatus({
          authorized: false,
          expired: true,
          authUrl: getConnectorAuthUrl(conn.type, connectionId),
          message: `Token refresh failed: ${message}`,
        });
      }
      const parsed = parseConnectorTokenResponse(connectionId, refreshData as Record<string, any>);
      if (!parsed) {
        return tokenStatus({
          authorized: false,
          expired: true,
          authUrl: getConnectorAuthUrl(conn.type, connectionId),
          message: 'Token refresh did not return a usable access token',
        });
      }

      const newExpiresAt = parsed.expiresIn ? Math.floor(Date.now() / 1000) + parsed.expiresIn : null;
      db.prepare(`
        UPDATE user_tokens SET access_token = ?, refresh_token = ?, token_type = ?, expires_at = ?, updated_at = datetime('now')
        WHERE user_id = ? AND connection_id = ?
      `).run(
        parsed.accessToken,
        parsed.refreshToken || token.refresh_token,
        parsed.tokenType,
        newExpiresAt,
        userId,
        connectionId,
      );

      return tokenStatus({
        authorized: true,
        token_type: parsed.tokenType,
        expires_in: parsed.expiresIn || undefined,
        refreshed: true,
      });
    } catch (err) {
      return tokenStatus({
        authorized: false,
        expired: true,
        authUrl: getConnectorAuthUrl(conn.type, connectionId),
        message: `Token refresh error: ${err instanceof Error ? err.message : 'unknown'}`,
      });
    }
  }

  if (expiresAt && expiresAt < now) {
    return tokenStatus({
      authorized: false,
      expired: true,
      authUrl: getConnectorAuthUrl(conn.type, connectionId),
      message: 'Token expired. Please reconnect.',
    });
  }

  return tokenStatus({
    authorized: true,
    token_type: token.token_type || 'Bearer',
    expires_in: expiresAt ? Math.max(0, expiresAt - now) : undefined,
  });
}
