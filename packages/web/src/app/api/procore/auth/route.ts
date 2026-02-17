import { NextResponse } from 'next/server';

/**
 * GET /api/procore/auth — Redirect to Procore OAuth authorization
 */
export async function GET() {
  const clientId = process.env.PROCORE_CLIENT_ID;
  const redirectUri = process.env.PROCORE_REDIRECT_URI || 'http://localhost:3000/api/procore/callback';

  if (!clientId) {
    return NextResponse.json({ error: 'PROCORE_CLIENT_ID not configured' }, { status: 500 });
  }

  const authUrl = new URL('https://sandbox.procore.com/oauth/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);

  return NextResponse.redirect(authUrl.toString());
}
