import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * GET /api/procore/status — Check Procore connection status
 */
export async function GET() {
  const tokenPath = join(process.cwd(), '..', '..', '.procore-tokens.json');

  try {
    const data = await readFile(tokenPath, 'utf-8');
    const tokens = JSON.parse(data);
    const expiresAt = (tokens.created_at || 0) + (tokens.expires_in || 0);
    const remaining = expiresAt - Math.floor(Date.now() / 1000);

    return NextResponse.json({
      connected: true,
      expired: remaining < 0,
      expires_in_seconds: remaining,
      token_type: tokens.token_type || 'unknown',
    });
  } catch {
    return NextResponse.json({
      connected: false,
      reason: 'No tokens found. Connect via /api/procore/auth',
    });
  }
}
