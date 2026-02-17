/**
 * GET /api/procore/status
 * Returns whether Procore tokens exist and are valid.
 */

import { NextResponse } from 'next/server';
import { loadTokens, isTokenExpired, hasTokens } from '@/lib/procore';

export async function GET(): Promise<NextResponse> {
  if (!hasTokens()) {
    return NextResponse.json({ connected: false, reason: 'no_tokens' });
  }

  const tokens = loadTokens();
  if (!tokens) {
    return NextResponse.json({ connected: false, reason: 'invalid_tokens_file' });
  }

  const expired = isTokenExpired(tokens);
  return NextResponse.json({
    connected: true,
    expired,
    expiresAt: new Date((tokens.created_at + tokens.expires_in) * 1000).toISOString(),
  });
}
