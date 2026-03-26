import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getConnection, getConnectionSecrets } from '@/lib/admin-db';
import { userHasAssignedConnection } from '@/lib/api-guard';

const PROCORE_OAUTH_STATE_COOKIE = 'buildai_procore_oauth_state';
const PROCORE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

type ProcoreOAuthState = {
  state: string;
  userId: string;
  connectionId: string;
  issuedAt: number;
};

/**
 * GET /api/procore/callback — OAuth callback, exchanges code for tokens.
 * Stores per-user tokens in SQLite (not a global file).
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  const code = request.nextUrl.searchParams.get('code');
  const stateParam = request.nextUrl.searchParams.get('state');
  const error = request.nextUrl.searchParams.get('error');

  if (error) {
    return htmlResponse('error', `Procore Authorization Failed: ${error}`, true);
  }

  if (!userId) {
    return htmlResponse('error', 'Not authenticated', true);
  }

  if (!code || !stateParam) {
    return htmlResponse('error', 'Missing authorization code or state', true);
  }

  const cookieValue = request.cookies.get(PROCORE_OAUTH_STATE_COOKIE)?.value;
  const oauthState = decodeOAuthState(cookieValue);
  if (!oauthState) {
    return htmlResponse('error', 'Invalid or expired OAuth state', true);
  }
  if (oauthState.state !== stateParam) {
    return htmlResponse('error', 'OAuth state mismatch', true);
  }
  if (oauthState.userId !== userId) {
    return htmlResponse('error', 'OAuth state does not match the current user', true);
  }
  if (Date.now() - oauthState.issuedAt > PROCORE_OAUTH_STATE_TTL_MS) {
    return htmlResponse('error', 'OAuth state expired', true);
  }

  if (!userHasAssignedConnection(userId, oauthState.connectionId)) {
    return htmlResponse('error', 'Connection access is no longer available for this user', true);
  }

  const { getDb } = await import('@/lib/admin-db-server');
  const db = getDb();

  const conn = getConnection(oauthState.connectionId);
  if (!conn) {
    return htmlResponse('error', 'Connection not found', true);
  }

  const config = JSON.parse(conn.config || '{}');
  const clientId = config.clientId;
  const clientSecret = getConnectionSecrets(oauthState.connectionId)?.clientSecret;
  const baseUrl = config.oauthBaseUrl || 'https://login.procore.com';
  const redirectUri = `${request.nextUrl.origin}/api/procore/callback`;

  if (!clientId || !clientSecret) {
    return htmlResponse('error', 'Connection missing client_id or client_secret', true);
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
      return htmlResponse('error', `Token exchange failed: ${tokens.error_description || tokens.error}`, true);
    }

    // Store per-user tokens
    const expiresAt = Math.floor(Date.now() / 1000) + (tokens.expires_in || 7200);

    db.prepare(`
      INSERT OR REPLACE INTO user_tokens (user_id, connection_id, access_token, refresh_token, token_type, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      oauthState.connectionId,
      tokens.access_token,
      tokens.refresh_token || null,
      tokens.token_type || 'Bearer',
      expiresAt,
    );

    return htmlResponse('success', 'Procore Connected! You can close this window and return to the chat.', true);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return htmlResponse('error', `Token exchange failed: ${message}`, true);
  }
}

function decodeOAuthState(value: string | undefined): ProcoreOAuthState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString()) as Partial<ProcoreOAuthState>;
    if (
      typeof parsed.state !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.connectionId !== 'string' ||
      typeof parsed.issuedAt !== 'number'
    ) {
      return null;
    }
    return parsed as ProcoreOAuthState;
  } catch {
    return null;
  }
}

function htmlResponse(type: 'success' | 'error', message: string, clearStateCookie = false) {
  const icon = type === 'success' ? '✅' : '❌';
  const color = type === 'success' ? '#22c55e' : '#ef4444';
  const response = new NextResponse(
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
  if (clearStateCookie) {
    response.cookies.delete(PROCORE_OAUTH_STATE_COOKIE);
  }
  return response;
}
