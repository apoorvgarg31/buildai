import { NextRequest, NextResponse } from 'next/server';
import { getCategories, listMarketplaceSkills } from '@/lib/marketplace';
import { canAccessAgent, requireSignedIn } from '@/lib/api-guard';
import { listUserSkillInstalls } from '@/lib/admin-db';
import { apiError } from '@/lib/api-error';

type RequirementState = {
  type: string;
  authMode: 'shared' | 'oauth_user' | 'token_user';
  connectionId?: string;
  connectionName?: string;
  connectUrl?: string;
  ready: boolean;
  needsUserAuth: boolean;
  available: boolean;
};

function getRequiredConnectionTypes(skill: { connectionType?: string }): string[] {
  return skill.connectionType ? [skill.connectionType] : [];
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireSignedIn();
    const agentId = request.nextUrl.searchParams.get('agentId') || actor.agentId || undefined;

    if (agentId) {
      if (!canAccessAgent(actor, agentId)) return apiError('forbidden_agent_access', 'Forbidden', 403, { reason: 'AGENT_ACCESS_DENIED' });
    }

    const userInstalls = listUserSkillInstalls(actor.userId);
    const userSet = new Set(userInstalls.map((u) => u.skill_id));
    const { getDb } = await import('@/lib/admin-db-server');
    const db = getDb();

    const assignedConnections = agentId
      ? db.prepare(`
        SELECT c.id, c.name, c.type, c.auth_mode, c.status
        FROM connections c
        JOIN agent_connections ac ON ac.connection_id = c.id
        WHERE ac.agent_id = ?
      `).all(agentId) as Array<{ id: string; name: string; type: string; auth_mode?: 'shared' | 'oauth_user' | 'token_user'; status: string }>
      : [];

    const tokenRows = assignedConnections.length > 0
      ? db.prepare('SELECT connection_id, expires_at FROM user_tokens WHERE user_id = ?').all(actor.userId) as Array<{ connection_id: string; expires_at?: number | null }>
      : [];
    const now = Math.floor(Date.now() / 1000);
    const validTokenByConnectionId = new Map(tokenRows.map((row) => [row.connection_id, !row.expires_at || row.expires_at > now]));

    const skills = listMarketplaceSkills().map((s) => {
      const installedByUser = userSet.has(s.id);
      const requiredConnectionTypes = getRequiredConnectionTypes(s);
      const requirementStates: RequirementState[] = requiredConnectionTypes.map((type) => {
        const connection = assignedConnections.find((item) => item.type === type);
        const authMode = connection?.auth_mode || 'shared';
        const userAuthorized = !connection
          ? false
          : authMode === 'shared'
            ? true
            : !!validTokenByConnectionId.get(connection.id);
        const ready = !!connection && connection.status === 'connected' && userAuthorized;

        return {
          type,
          authMode,
          connectionId: connection?.id,
          connectionName: connection?.name,
          connectUrl: connection?.type === 'procore' ? `/api/procore/auth?connectionId=${connection.id}` : undefined,
          available: !!connection,
          needsUserAuth: !!connection && authMode !== 'shared' && !userAuthorized,
          ready,
        };
      });

      return {
        ...s,
        installedByUser,
        requiresConnections: requiredConnectionTypes.length > 0,
        requiredConnectionTypes,
        requirementStates,
        requirementsSatisfied: requirementStates.every((state) => state.ready),
        effectiveSource: installedByUser ? 'user_installed_public' : 'public',
        removableByUser: installedByUser,
        installablePublic: !installedByUser,
      };
    });

    const categories = getCategories();
    return NextResponse.json({ skills, categories });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    console.error('Marketplace list error:', err);
    return apiError('internal_error', 'Failed to list skills', 500);
  }
}
