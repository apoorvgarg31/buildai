/**
 * GET /api/procore/callback
 * Receives the OAuth authorization code from Procore,
 * exchanges it for tokens, saves them, and redirects to the app.
 */

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, saveTokens } from '@/lib/procore';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');

  if (error) {
    const desc = request.nextUrl.searchParams.get('error_description') || error;
    return NextResponse.redirect(
      new URL(`/?procore_error=${encodeURIComponent(desc)}`, request.url),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/?procore_error=missing_code', request.url),
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    saveTokens(tokens);

    return NextResponse.redirect(
      new URL('/?procore_connected=true', request.url),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Procore callback error:', msg);
    return NextResponse.redirect(
      new URL(`/?procore_error=${encodeURIComponent(msg)}`, request.url),
    );
  }
}
