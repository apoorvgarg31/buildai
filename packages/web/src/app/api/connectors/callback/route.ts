import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getConnection } from '@/lib/admin-db';
import { userHasAssignedConnection } from '@/lib/api-guard';
import { CONNECTOR_OAUTH_STATE_COOKIE, CONNECTOR_OAUTH_STATE_TTL_MS, decodeConnectorOAuthState, exchangeConnectorCodeRequest, parseConnectorTokenResponse } from '@/lib/connector-oauth';

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  const code = request.nextUrl.searchParams.get('code');
  const stateParam = request.nextUrl.searchParams.get('state');
  const error = request.nextUrl.searchParams.get('error');

  if (error) {
    return htmlResponse('error', `Connector authorization failed: ${error}`, true);
  }
  if (!userId) {
    return htmlResponse('error', 'Not authenticated', true);
  }
  if (!code || !stateParam) {
    return htmlResponse('error', 'Missing authorization code or state', true);
  }

  const oauthState = decodeConnectorOAuthState(request.cookies.get(CONNECTOR_OAUTH_STATE_COOKIE)?.value);
  if (!oauthState) {
    return htmlResponse('error', 'Invalid or expired OAuth state', true);
  }
  if (oauthState.state != stateParam) {
    return htmlResponse('error', 'OAuth state mismatch', true);
  }
  if (oauthState.userId !== userId) {
    return htmlResponse('error', 'OAuth state does not match the current user', true);
  }
  if (Date.now() - oauthState.issuedAt > CONNECTOR_OAUTH_STATE_TTL_MS) {
    return htmlResponse('error', 'OAuth state expired', true);
  }
  if (!userHasAssignedConnection(userId, oauthState.connectionId)) {
    return htmlResponse('error', 'Connection access is no longer available for this user', true);
  }

  const conn = getConnection(oauthState.connectionId);
  if (!conn) {
    return htmlResponse('error', 'Connection not found', true);
  }

  try {
    const exchange = exchangeConnectorCodeRequest(oauthState.connectionId, code, request.nextUrl.origin);
    const tokenResponse = await fetch(exchange.url, exchange.init);
    const tokenData = await tokenResponse.json();

    if ((tokenData && typeof tokenData === 'object' && 'error' in tokenData) || !tokenResponse.ok) {
      const message = tokenData?.error_description || tokenData?.error || `HTTP ${tokenResponse.status}`;
      return htmlResponse('error', `Token exchange failed: ${message}`, true);
    }

    const parsed = parseConnectorTokenResponse(oauthState.connectionId, tokenData as Record<string, any>);
    if (!parsed) {
      return htmlResponse('error', 'Token exchange did not return a usable access token', true);
    }

    const { getDb } = await import('@/lib/admin-db-server');
    const db = getDb();
    const expiresAt = parsed.expiresIn ? Math.floor(Date.now() / 1000) + parsed.expiresIn : null;

    db.prepare(`
      INSERT OR REPLACE INTO user_tokens (user_id, connection_id, access_token, refresh_token, token_type, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      oauthState.connectionId,
      parsed.accessToken,
      parsed.refreshToken,
      parsed.tokenType,
      expiresAt,
    );

    return htmlResponse('success', `${conn.name} connected. You can close this window and return to Mira.`, true);
  } catch (err) {
    return htmlResponse('error', `Token exchange failed: ${err instanceof Error ? err.message : 'unknown error'}`, true);
  }
}

function htmlResponse(type: 'success' | 'error', message: string, clearStateCookie = false) {
  const icon = type === 'success' ? '✅' : '❌';
  const color = type === 'success' ? '#22c55e' : '#ef4444';
  const response = new NextResponse(
    `<!DOCTYPE html>
<html><head><title>Connector ${type === 'success' ? 'Connected' : 'Error'}</title></head>
<body style="font-family:system-ui;background:#fff;color:#171717;display:flex;justify-content:center;align-items:center;height:100vh;margin:0">
  <div style="text-align:center;max-width:420px;padding:24px">
    <div style="font-size:48px;margin-bottom:16px">${icon}</div>
    <h1 style="color:${color};font-size:20px;margin:0 0 12px">${type === 'success' ? 'Connected!' : 'Error'}</h1>
    <p style="color:#666;font-size:14px;line-height:1.5">${message}</p>
    ${type === 'success' ? '<script>setTimeout(()=>window.close(),3000)</script>' : ''}
  </div>
</body></html>`,
    { headers: { 'Content-Type': 'text/html' } },
  );
  if (clearStateCookie) response.cookies.delete(CONNECTOR_OAUTH_STATE_COOKIE);
  return response;
}
