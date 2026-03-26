import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

type AuthMode = 'shared' | 'oauth_user' | 'token_user';

/**
 * GET /api/agent/connections — Returns the connections assigned to the current user's agent.
 * Used by the agent to know what integrations are available.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { getDb } = await import('@/lib/admin-db-server');
  const db = getDb();

  // Get user's assigned agent
  const user = db.prepare('SELECT agent_id FROM users WHERE id = ?').get(userId) as { agent_id: string | null } | undefined;
  if (!user?.agent_id) {
    return NextResponse.json({ connections: [], message: 'No agent assigned' });
  }

  // Get agent's connections
  const connections = db.prepare(`
    SELECT c.id, c.name, c.type, c.auth_mode, c.config, c.status
    FROM connections c
    JOIN agent_connections ac ON ac.connection_id = c.id
    WHERE ac.agent_id = ?
    ORDER BY c.type, c.name
  `).all(user.agent_id) as Array<{
    id: string;
    name: string;
    type: string;
    auth_mode?: AuthMode;
    config: string;
    status: string;
  }>;

  // Check user token status for each connection
  const result = connections.map(conn => {
    const config = JSON.parse(conn.config || '{}');
    const authMode = conn.auth_mode || 'shared';
    const token = db.prepare(
      'SELECT expires_at FROM user_tokens WHERE user_id = ? AND connection_id = ?'
    ).get(userId, conn.id) as { expires_at: number } | undefined;

    const now = Math.floor(Date.now() / 1000);
    const tokenValid = token ? !token.expires_at || token.expires_at > now : false;
    const userAuthorized = authMode === 'shared' ? true : tokenValid;
    const readyForUse = conn.status === 'connected' && userAuthorized;

    return {
      id: conn.id,
      name: conn.name,
      type: conn.type,
      authMode,
      status: conn.status,
      userAuthorized,
      readyForUse,
      requiresUserAuth: authMode !== 'shared',
      authUrl: conn.type === 'procore' ? `/api/procore/auth?connectionId=${conn.id}` : undefined,
      environment: config.oauthBaseUrl?.includes('sandbox') ? 'sandbox' : 'production',
    };
  });

  return NextResponse.json({ agentId: user.agent_id, connections: result });
}
