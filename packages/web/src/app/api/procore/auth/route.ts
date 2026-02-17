/**
 * GET /api/procore/auth
 * Redirects the user to Procore's OAuth authorization page.
 */

import { NextResponse } from 'next/server';
import { getAuthorizationUrl } from '@/lib/procore';

export async function GET(): Promise<NextResponse> {
  const url = getAuthorizationUrl();
  return NextResponse.redirect(url);
}
