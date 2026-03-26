import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { buildConnectorRuntimeState, type ConnectorAuthMode } from '@/lib/connector-runtime';

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
    auth_mode?: ConnectorAuthMode;
    config: string;
    status: string;
  }>;

  const tokenRows = connections.length > 0
    ? db.prepare('SELECT connection_id, expires_at FROM user_tokens WHERE user_id = ?').all(userId) as Array<{ connection_id: string; expires_at?: number | null }>
    : [];
  const tokenByConnectionId = new Map(tokenRows.map((row) => [row.connection_id, row]));

  const result = connections.map(conn => {
    const config = JSON.parse(conn.config || '{}');
    const state = buildConnectorRuntimeState(conn.type, conn, tokenByConnectionId.get(conn.id));

    return {
      id: conn.id,
      name: conn.name,
      type: conn.type,
      authMode: state.authMode,
      status: conn.status,
      userAuthorized: state.userAuthorized,
      readyForUse: state.ready,
      requiresUserAuth: state.authMode !== 'shared',
      tokenExpired: state.tokenExpired,
      reconnectRequired: state.reconnectRequired,
      blockedReason: state.blockedReason,
      statusLabel: state.statusLabel,
      actionLabel: state.actionLabel,
      authUrl: state.connectUrl,
      environment: config.oauthBaseUrl?.includes('sandbox') ? 'sandbox' : 'production',
    };
  });

  return NextResponse.json({ agentId: user.agent_id, connections: result });
}
