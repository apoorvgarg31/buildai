import { NextRequest, NextResponse } from 'next/server';
import { getConnection, getConnectionSecrets } from '@/lib/admin-db';
import { userHasAssignedConnection } from '@/lib/api-guard';

/**
 * GET /api/procore/callback — OAuth callback, exchanges code for tokens.
 * Stores per-user tokens in SQLite (not a global file).
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const stateParam = request.nextUrl.searchParams.get('state');
  const error = request.nextUrl.searchParams.get('error');

  if (error) {
    return htmlResponse('error', `Procore Authorization Failed: ${error}`);
  }

  if (!code || !stateParam) {
    return htmlResponse('error', 'Missing authorization code or state');
  }

  // Decode state to get userId + connectionId
  let state: { userId: string; connectionId: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
  } catch {
    return htmlResponse('error', 'Invalid state parameter');
  }

  if (!userHasAssignedConnection(state.userId, state.connectionId)) {
    return htmlResponse('error', 'Connection access is no longer available for this user');
  }

  const { getDb } = await import('@/lib/admin-db-server');
  const db = getDb();

  const conn = getConnection(state.connectionId);
  if (!conn) {
    return htmlResponse('error', 'Connection not found');
  }

  const config = JSON.parse(conn.config || '{}');
  const clientId = config.clientId;
  const clientSecret = getConnectionSecrets(state.connectionId)?.clientSecret;
  const baseUrl = config.oauthBaseUrl || 'https://login.procore.com';
  const redirectUri = `${request.nextUrl.origin}/api/procore/callback`;

  if (!clientId || !clientSecret) {
    return htmlResponse('error', 'Connection missing client_id or client_secret');
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      return htmlResponse('error', `Token exchange failed: ${tokens.error_description || tokens.error}`);
    }

    // Store per-user tokens
    const expiresAt = Math.floor(Date.now() / 1000) + (tokens.expires_in || 7200);

    db.prepare(`
      INSERT OR REPLACE INTO user_tokens (user_id, connection_id, access_token, refresh_token, token_type, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      state.userId,
      state.connectionId,
      tokens.access_token,
      tokens.refresh_token || null,
      tokens.token_type || 'Bearer',
      expiresAt,
    );

    return htmlResponse('success', 'Procore Connected! You can close this window and return to the chat.');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return htmlResponse('error', `Token exchange failed: ${message}`);
  }
}

function htmlResponse(type: 'success' | 'error', message: string) {
  const icon = type === 'success' ? '✅' : '❌';
  const color = type === 'success' ? '#22c55e' : '#ef4444';
  return new NextResponse(
    `<!DOCTYPE html>
<html><head><title>Procore ${type === 'success' ? 'Connected' : 'Error'}</title></head>
<body style="font-family:system-ui;background:#fff;color:#171717;display:flex;justify-content:center;align-items:center;height:100vh;margin:0">
  <div style="text-align:center;max-width:400px;padding:24px">
    <div style="font-size:48px;margin-bottom:16px">${icon}</div>
    <h1 style="color:${color};font-size:20px;margin:0 0 12px">${type === 'success' ? 'Connected!' : 'Error'}</h1>
    <p style="color:#666;font-size:14px;line-height:1.5">${message}</p>
    ${type === 'success' ? '<script>setTimeout(()=>window.close(),3000)</script>' : ''}
  </div>
</body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}
