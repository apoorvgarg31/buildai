import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getConnection } from '@/lib/admin-db';
import { userHasAssignedConnection } from '@/lib/api-guard';

/**
 * GET /api/procore/auth?connectionId=xxx — Redirect user to Procore OAuth.
 * Uses client_id from the connection's stored secrets.
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
  if (!userHasAssignedConnection(userId, connectionId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const conn = getConnection(connectionId);
  if (!conn || conn.type !== 'procore') {
    return NextResponse.json({ error: 'Procore connection not found' }, { status: 404 });
  }

  const config = JSON.parse(conn.config || '{}');
  const clientId = config.clientId;
  const baseUrl = config.oauthBaseUrl || 'https://login.procore.com';

  if (!clientId) {
    return NextResponse.json({ error: 'Client ID not configured on this connection' }, { status: 500 });
  }

  const redirectUri = `${request.nextUrl.origin}/api/procore/callback`;

  // Store state so we can match the callback to user + connection
  const state = Buffer.from(JSON.stringify({ userId, connectionId })).toString('base64url');

  const authUrl = new URL(`${baseUrl}/oauth/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);

  return NextResponse.redirect(authUrl.toString());
}
