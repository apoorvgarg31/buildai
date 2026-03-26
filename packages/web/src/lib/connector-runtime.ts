import { getDefaultConnectorAuthMode } from './connector-catalog';

export type ConnectorAuthMode = 'shared' | 'oauth_user' | 'token_user';

export type ConnectorBlockedReason =
  | 'ready'
  | 'admin_setup_required'
  | 'connection_not_ready'
  | 'user_auth_required'
  | 'reconnect_required';

export type AssignedConnection = {
  id: string;
  name: string;
  type: string;
  auth_mode?: ConnectorAuthMode;
  status: string;
  config?: string;
};

export type UserTokenRow = {
  connection_id: string;
  expires_at?: number | null;
};

export type ConnectorRuntimeState = {
  type: string;
  authMode: ConnectorAuthMode;
  connectionId?: string;
  connectionName?: string;
  connectUrl?: string;
  available: boolean;
  ready: boolean;
  userAuthorized: boolean;
  needsUserAuth: boolean;
  tokenExpired: boolean;
  reconnectRequired: boolean;
  blockedReason: ConnectorBlockedReason;
  statusLabel: string;
  actionLabel?: string;
};

type SkillLike = { connectionType?: string };

export function getRequiredConnectionTypes(skill: SkillLike): string[] {
  return skill.connectionType ? [skill.connectionType] : [];
}

export function getConnectorAuthUrl(type: string, connectionId: string): string | undefined {
  if (type === 'procore') return `/api/procore/auth?connectionId=${connectionId}`;
  return undefined;
}

export function buildConnectorRuntimeState(
  type: string,
  connection: AssignedConnection | undefined,
  token: UserTokenRow | undefined,
  now = Math.floor(Date.now() / 1000),
): ConnectorRuntimeState {
  const authMode = connection?.auth_mode || getDefaultConnectorAuthMode(type);
  const available = !!connection;
  const hasToken = !!token;
  const tokenExpired = !!token && !!token.expires_at && token.expires_at <= now;
  const tokenValid = !!token && (!token.expires_at || token.expires_at > now);
  const userAuthorized = authMode === 'shared' ? available : tokenValid;
  const connectionReady = !!connection && connection.status === 'connected';

  if (!connection) {
    return {
      type,
      authMode,
      available: false,
      ready: false,
      userAuthorized: false,
      needsUserAuth: false,
      tokenExpired: false,
      reconnectRequired: false,
      blockedReason: 'admin_setup_required',
      statusLabel: 'Admin setup needed',
    };
  }

  if (!connectionReady) {
    return {
      type,
      authMode,
      connectionId: connection.id,
      connectionName: connection.name,
      connectUrl: getConnectorAuthUrl(connection.type, connection.id),
      available: true,
      ready: false,
      userAuthorized,
      needsUserAuth: false,
      tokenExpired,
      reconnectRequired: false,
      blockedReason: 'connection_not_ready',
      statusLabel: 'Connector unavailable',
    };
  }

  if (authMode === 'shared') {
    return {
      type,
      authMode,
      connectionId: connection.id,
      connectionName: connection.name,
      connectUrl: getConnectorAuthUrl(connection.type, connection.id),
      available: true,
      ready: true,
      userAuthorized: true,
      needsUserAuth: false,
      tokenExpired: false,
      reconnectRequired: false,
      blockedReason: 'ready',
      statusLabel: 'Ready',
    };
  }

  if (tokenValid) {
    return {
      type,
      authMode,
      connectionId: connection.id,
      connectionName: connection.name,
      connectUrl: getConnectorAuthUrl(connection.type, connection.id),
      available: true,
      ready: true,
      userAuthorized: true,
      needsUserAuth: false,
      tokenExpired: false,
      reconnectRequired: false,
      blockedReason: 'ready',
      statusLabel: 'Ready',
    };
  }

  if (tokenExpired) {
    return {
      type,
      authMode,
      connectionId: connection.id,
      connectionName: connection.name,
      connectUrl: getConnectorAuthUrl(connection.type, connection.id),
      available: true,
      ready: false,
      userAuthorized: false,
      needsUserAuth: true,
      tokenExpired: true,
      reconnectRequired: true,
      blockedReason: 'reconnect_required',
      statusLabel: 'Reconnect required',
      actionLabel: authMode === 'token_user' ? 'Update personal token' : 'Reconnect account',
    };
  }

  return {
    type,
    authMode,
    connectionId: connection.id,
    connectionName: connection.name,
    connectUrl: getConnectorAuthUrl(connection.type, connection.id),
    available: true,
    ready: false,
    userAuthorized: false,
    needsUserAuth: !hasToken,
    tokenExpired: false,
    reconnectRequired: false,
    blockedReason: 'user_auth_required',
    statusLabel: authMode === 'token_user' ? 'Personal token required' : 'Needs sign-in',
    actionLabel: authMode === 'token_user' ? 'Add personal token' : 'Connect account',
  };
}

export function resolveSkillConnectionRequirements(
  db: { prepare: (...args: any[]) => { all: (...params: any[]) => unknown[] } },
  userId: string,
  agentId: string | undefined,
  skill: SkillLike,
): {
  requiredConnectionTypes: string[];
  requirementStates: ConnectorRuntimeState[];
  requirementsSatisfied: boolean;
} {
  const requiredConnectionTypes = getRequiredConnectionTypes(skill);
  if (!agentId || requiredConnectionTypes.length === 0) {
    return {
      requiredConnectionTypes,
      requirementStates: requiredConnectionTypes.map((type) => buildConnectorRuntimeState(type, undefined, undefined)),
      requirementsSatisfied: requiredConnectionTypes.length === 0,
    };
  }

  const assignedConnections = db.prepare(`
    SELECT c.id, c.name, c.type, c.auth_mode, c.status, c.config
    FROM connections c
    JOIN agent_connections ac ON ac.connection_id = c.id
    WHERE ac.agent_id = ?
  `).all(agentId) as AssignedConnection[];

  const tokenRows = assignedConnections.length > 0
    ? db.prepare('SELECT connection_id, expires_at FROM user_tokens WHERE user_id = ?').all(userId) as UserTokenRow[]
    : [];
  const tokenByConnectionId = new Map(tokenRows.map((row) => [row.connection_id, row]));
  const now = Math.floor(Date.now() / 1000);

  const requirementStates = requiredConnectionTypes.map((type) => {
    const connection = assignedConnections.find((item) => item.type === type);
    const token = connection ? tokenByConnectionId.get(connection.id) : undefined;
    return buildConnectorRuntimeState(type, connection, token, now);
  });

  return {
    requiredConnectionTypes,
    requirementStates,
    requirementsSatisfied: requirementStates.every((state) => state.ready),
  };
}

export function buildSkillInstallInstructions(
  skillName: string,
  requirements: { requirementStates: ConnectorRuntimeState[]; requirementsSatisfied: boolean },
): string {
  if (requirements.requirementStates.length === 0) {
    return `Skill installed successfully. ${skillName} is ready to use right away.`;
  }

  if (requirements.requirementsSatisfied) {
    return `Skill installed successfully. The required connectors are already ready, so ${skillName} can be used immediately.`;
  }

  const primary = requirements.requirementStates.find((state) => !state.ready);
  if (!primary) {
    return `Skill installed successfully. ${skillName} is ready to use right away.`;
  }

  const label = primary.connectionName || primary.type;
  switch (primary.blockedReason) {
    case 'admin_setup_required':
      return `Skill installed. Your admin still needs to configure the ${label} connector in Connectors before ${skillName} can run.`;
    case 'reconnect_required':
      return `Skill installed. Open Connectors and reconnect ${label} before using ${skillName}.`;
    case 'user_auth_required':
      return primary.authMode === 'token_user'
        ? `Skill installed. Open Connectors and add your personal token for ${label} before using ${skillName}.`
        : `Skill installed. Open Connectors and sign in to ${label} before using ${skillName}.`;
    case 'connection_not_ready':
      return `Skill installed. ${label} is configured but not ready yet. Ask your admin to finish testing it in Connectors before using ${skillName}.`;
    default:
      return `Skill installed successfully. ${skillName} is ready to use right away.`;
  }
}
