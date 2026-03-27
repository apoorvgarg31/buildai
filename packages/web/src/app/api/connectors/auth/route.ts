import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import crypto from 'node:crypto';
import { getConnection } from '@/lib/admin-db';
import { userHasAssignedConnection } from '@/lib/api-guard';
import { buildConnectorAuthorizationUrl, CONNECTOR_OAUTH_STATE_COOKIE, CONNECTOR_OAUTH_STATE_TTL_MS, encodeConnectorOAuthState } from '@/lib/connector-oauth';

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

  try {
    const state = crypto.randomBytes(24).toString('base64url');
    const authUrl = buildConnectorAuthorizationUrl(connectionId, request.nextUrl.origin, state);
    const response = NextResponse.redirect(authUrl.toString());
    response.cookies.set(CONNECTOR_OAUTH_STATE_COOKIE, encodeConnectorOAuthState({
      state,
      userId,
      connectionId,
      issuedAt: Date.now(),
    }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/api/connectors/callback',
      maxAge: Math.floor(CONNECTOR_OAUTH_STATE_TTL_MS / 1000),
    });
    return response;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to start connector auth' }, { status: 500 });
  }
}
