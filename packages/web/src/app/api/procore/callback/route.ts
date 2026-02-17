import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * GET /api/procore/callback — OAuth callback, exchanges code for tokens
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');

  if (error) {
    return new NextResponse(
      `<html><body style="font-family:system-ui;background:#0f172a;color:#f1f5f9;display:flex;justify-content:center;align-items:center;height:100vh;margin:0">
        <div style="text-align:center">
          <h1 style="color:#ef4444">❌ Procore Authorization Failed</h1>
          <p>${error}</p>
          <a href="/admin/connections" style="color:#818cf8">← Back to Connections</a>
        </div>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  if (!code) {
    return NextResponse.json({ error: 'No authorization code received' }, { status: 400 });
  }

  const clientId = process.env.PROCORE_CLIENT_ID;
  const clientSecret = process.env.PROCORE_CLIENT_SECRET;
  const redirectUri = process.env.PROCORE_REDIRECT_URI || 'http://localhost:3000/api/procore/callback';

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Procore OAuth not configured' }, { status: 500 });
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://sandbox.procore.com/oauth/token', {
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
      return new NextResponse(
        `<html><body style="font-family:system-ui;background:#0f172a;color:#f1f5f9;display:flex;justify-content:center;align-items:center;height:100vh;margin:0">
          <div style="text-align:center">
            <h1 style="color:#ef4444">❌ Token Exchange Failed</h1>
            <p>${tokens.error_description || tokens.error}</p>
            <a href="/admin/connections" style="color:#818cf8">← Back to Connections</a>
          </div>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Save tokens to file (used by the engine skill)
    const tokenPath = join(process.cwd(), '..', '..', '.procore-tokens.json');
    await writeFile(tokenPath, JSON.stringify(tokens, null, 2));

    // Also save to engine skill directory for direct access
    const skillTokenPath = join(process.cwd(), '..', 'engine', '.procore-tokens.json');
    try {
      await writeFile(skillTokenPath, JSON.stringify(tokens, null, 2));
    } catch {
      // Skill path might not exist, that's fine — root tokens are the source of truth
    }

    return new NextResponse(
      `<html><body style="font-family:system-ui;background:#0f172a;color:#f1f5f9;display:flex;justify-content:center;align-items:center;height:100vh;margin:0">
        <div style="text-align:center">
          <h1 style="color:#22c55e">✅ Procore Connected!</h1>
          <p>OAuth tokens saved successfully.</p>
          <p style="color:#94a3b8">Token type: ${tokens.token_type} | Expires in: ${Math.round(tokens.expires_in / 3600)}h</p>
          <a href="/admin/connections" style="color:#818cf8;text-decoration:none;padding:8px 24px;border:1px solid #818cf8;border-radius:8px;display:inline-block;margin-top:16px">← Back to Connections</a>
        </div>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Token exchange failed', details: message }, { status: 500 });
  }
}
