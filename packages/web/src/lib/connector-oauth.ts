import { getConnection, getConnectionSecrets } from './admin-db';
import { getDefaultConnectorAuthMode } from './connector-catalog';

export const CONNECTOR_OAUTH_STATE_COOKIE = 'buildai_connector_oauth_state';
export const CONNECTOR_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export type OAuthStatePayload = {
  state: string;
  userId: string;
  connectionId: string;
  issuedAt: number;
};

export type ParsedTokenResponse = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  expiresIn: number | null;
};

type ProviderContext = {
  config: Record<string, unknown>;
  secrets: Record<string, string> | null;
  redirectUri: string;
};

type OAuthProviderDefinition = {
  type: string;
  authorizeUrl: (ctx: ProviderContext) => string;
  tokenUrl: (ctx: ProviderContext) => string;
  scopeParam?: 'scope' | 'user_scope';
  extraAuthParams?: (ctx: ProviderContext) => Record<string, string>;
  buildTokenBody?: (ctx: ProviderContext, code: string) => URLSearchParams;
  buildRefreshBody?: (ctx: ProviderContext, refreshToken: string) => URLSearchParams;
  tokenHeaders?: Record<string, string>;
  parseTokenResponse?: (data: Record<string, any>) => ParsedTokenResponse | null;
};

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function scopesFromConfig(config: Record<string, unknown>): string | undefined {
  const raw = config.scopes ?? config.scope ?? config.userScopes;
  if (Array.isArray(raw)) {
    const scopes = raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim());
    return scopes.length > 0 ? scopes.join(' ') : undefined;
  }
  return stringValue(raw);
}

function oauthBaseUrl(config: Record<string, unknown>, fallback: string): string {
  return stringValue(config.oauthBaseUrl) || fallback;
}

function oauthAuthorizeUrl(config: Record<string, unknown>, fallback: string): string {
  return stringValue(config.oauthAuthorizeUrl) || fallback;
}

function oauthTokenUrl(config: Record<string, unknown>, fallback: string): string {
  return stringValue(config.oauthTokenUrl) || fallback;
}

function oauthTenant(config: Record<string, unknown>): string {
  return stringValue(config.tenantId) || 'common';
}

function defaultTokenParser(data: Record<string, any>): ParsedTokenResponse | null {
  const accessToken = stringValue(data.access_token);
  if (!accessToken) return null;
  return {
    accessToken,
    refreshToken: stringValue(data.refresh_token) || null,
    tokenType: stringValue(data.token_type) || 'Bearer',
    expiresIn: typeof data.expires_in === 'number' && Number.isFinite(data.expires_in) ? data.expires_in : null,
  };
}

function slackTokenParser(data: Record<string, any>): ParsedTokenResponse | null {
  const userData = data.authed_user && typeof data.authed_user === 'object' ? data.authed_user : null;
  const accessToken = stringValue(userData?.access_token) || stringValue(data.access_token);
  if (!accessToken) return null;
  return {
    accessToken,
    refreshToken: stringValue(userData?.refresh_token) || stringValue(data.refresh_token) || null,
    tokenType: stringValue(data.token_type) || 'Bearer',
    expiresIn: typeof userData?.expires_in === 'number'
      ? userData.expires_in
      : (typeof data.expires_in === 'number' && Number.isFinite(data.expires_in) ? data.expires_in : null),
  };
}

function standardTokenBody(ctx: ProviderContext, code: string): URLSearchParams {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: ctx.redirectUri,
  });
  const clientId = stringValue(ctx.config.clientId);
  const clientSecret = stringValue(ctx.secrets?.clientSecret);
  if (clientId) body.set('client_id', clientId);
  if (clientSecret) body.set('client_secret', clientSecret);
  return body;
}

function standardRefreshBody(ctx: ProviderContext, refreshToken: string): URLSearchParams {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const clientId = stringValue(ctx.config.clientId);
  const clientSecret = stringValue(ctx.secrets?.clientSecret);
  if (clientId) body.set('client_id', clientId);
  if (clientSecret) body.set('client_secret', clientSecret);
  return body;
}

const OAUTH_PROVIDERS: Record<string, OAuthProviderDefinition> = {
  linear: {
    type: 'linear',
    authorizeUrl: () => 'https://linear.app/oauth/authorize',
    tokenUrl: () => 'https://api.linear.app/oauth/token',
  },
  github: {
    type: 'github',
    authorizeUrl: () => 'https://github.com/login/oauth/authorize',
    tokenUrl: () => 'https://github.com/login/oauth/access_token',
    tokenHeaders: { Accept: 'application/json' },
  },
  gitlab: {
    type: 'gitlab',
    authorizeUrl: (ctx) => `${oauthBaseUrl(ctx.config, 'https://gitlab.com')}/oauth/authorize`,
    tokenUrl: (ctx) => `${oauthBaseUrl(ctx.config, 'https://gitlab.com')}/oauth/token`,
  },
  jira: {
    type: 'jira',
    authorizeUrl: () => 'https://auth.atlassian.com/authorize',
    tokenUrl: () => 'https://auth.atlassian.com/oauth/token',
    extraAuthParams: () => ({ audience: 'api.atlassian.com', prompt: 'consent' }),
  },
  confluence: {
    type: 'confluence',
    authorizeUrl: () => 'https://auth.atlassian.com/authorize',
    tokenUrl: () => 'https://auth.atlassian.com/oauth/token',
    extraAuthParams: () => ({ audience: 'api.atlassian.com', prompt: 'consent' }),
  },
  notion: {
    type: 'notion',
    authorizeUrl: () => 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: () => 'https://api.notion.com/v1/oauth/token',
  },
  google_workspace: {
    type: 'google_workspace',
    authorizeUrl: () => 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: () => 'https://oauth2.googleapis.com/token',
    extraAuthParams: () => ({ access_type: 'offline', prompt: 'consent' }),
  },
  google_cloud: {
    type: 'google_cloud',
    authorizeUrl: () => 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: () => 'https://oauth2.googleapis.com/token',
    extraAuthParams: () => ({ access_type: 'offline', prompt: 'consent' }),
  },
  microsoft365: {
    type: 'microsoft365',
    authorizeUrl: (ctx) => `https://login.microsoftonline.com/${oauthTenant(ctx.config)}/oauth2/v2.0/authorize`,
    tokenUrl: (ctx) => `https://login.microsoftonline.com/${oauthTenant(ctx.config)}/oauth2/v2.0/token`,
    extraAuthParams: () => ({ response_mode: 'query' }),
  },
  slack: {
    type: 'slack',
    authorizeUrl: () => 'https://slack.com/oauth/v2/authorize',
    tokenUrl: () => 'https://slack.com/api/oauth.v2.access',
    scopeParam: 'user_scope',
    parseTokenResponse: slackTokenParser,
  },
  salesforce: {
    type: 'salesforce',
    authorizeUrl: (ctx) => `${oauthBaseUrl(ctx.config, 'https://login.salesforce.com')}/services/oauth2/authorize`,
    tokenUrl: (ctx) => `${oauthBaseUrl(ctx.config, 'https://login.salesforce.com')}/services/oauth2/token`,
  },
  hubspot: {
    type: 'hubspot',
    authorizeUrl: () => 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: () => 'https://api.hubapi.com/oauth/v1/token',
  },
  unifier: {
    type: 'unifier',
    authorizeUrl: (ctx) => oauthAuthorizeUrl(ctx.config, `${oauthBaseUrl(ctx.config, 'https://example.invalid')}/oauth/authorize`),
    tokenUrl: (ctx) => oauthTokenUrl(ctx.config, `${oauthBaseUrl(ctx.config, 'https://example.invalid')}/oauth/token`),
  },
};

export function listSupportedOAuthConnectorTypes(): string[] {
  return Object.keys(OAUTH_PROVIDERS);
}

export function getOAuthProviderDefinition(type: string): OAuthProviderDefinition | undefined {
  return OAUTH_PROVIDERS[type];
}

export function decodeConnectorOAuthState(value: string | undefined): OAuthStatePayload | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString()) as Partial<OAuthStatePayload>;
    if (
      typeof parsed.state !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.connectionId !== 'string' ||
      typeof parsed.issuedAt !== 'number'
    ) {
      return null;
    }
    return parsed as OAuthStatePayload;
  } catch {
    return null;
  }
}

export function encodeConnectorOAuthState(payload: OAuthStatePayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function getConnectorAuthUrl(type: string, connectionId: string): string | undefined {
  if (type === 'procore') return `/api/procore/auth?connectionId=${connectionId}`;
  const authMode = getDefaultConnectorAuthMode(type);
  if (authMode !== 'oauth_user') return undefined;
  return `/api/connectors/auth?connectionId=${connectionId}`;
}

export function getConnectorTokenStatusUrl(type: string, connectionId: string): string | undefined {
  if (type === 'procore') return `/api/procore/token?connectionId=${connectionId}`;
  const authMode = getDefaultConnectorAuthMode(type);
  if (authMode !== 'oauth_user') return undefined;
  return `/api/connectors/token?connectionId=${connectionId}`;
}

export function buildConnectorAuthorizationUrl(connectionId: string, origin: string, state: string): URL {
  const conn = getConnection(connectionId);
  if (!conn) throw new Error('Connection not found');
  if (conn.auth_mode !== 'oauth_user') throw new Error('Connection does not use user OAuth');
  if (conn.type === 'procore') throw new Error('Procore uses its dedicated OAuth route');

  const provider = getOAuthProviderDefinition(conn.type);
  if (!provider) throw new Error(`OAuth provider not supported for ${conn.type}`);

  const config = JSON.parse(conn.config || '{}') as Record<string, unknown>;
  const clientId = stringValue(config.clientId);
  if (!clientId) throw new Error('Client ID not configured on this connection');

  const redirectUri = `${origin}/api/connectors/callback`;
  const ctx: ProviderContext = {
    config,
    secrets: getConnectionSecrets(connectionId),
    redirectUri,
  };

  const authorizeUrl = new URL(provider.authorizeUrl(ctx));
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', state);

  const scopes = scopesFromConfig(config);
  if (scopes) authorizeUrl.searchParams.set(provider.scopeParam || 'scope', scopes);

  for (const [key, value] of Object.entries(provider.extraAuthParams?.(ctx) || {})) {
    if (value) authorizeUrl.searchParams.set(key, value);
  }

  return authorizeUrl;
}

export function exchangeConnectorCodeRequest(connectionId: string, code: string, origin: string): { url: string; init: RequestInit } {
  const conn = getConnection(connectionId);
  if (!conn) throw new Error('Connection not found');
  const provider = getOAuthProviderDefinition(conn.type);
  if (!provider) throw new Error(`OAuth provider not supported for ${conn.type}`);

  const config = JSON.parse(conn.config || '{}') as Record<string, unknown>;
  const secrets = getConnectionSecrets(connectionId);
  const clientId = stringValue(config.clientId);
  const clientSecret = stringValue(secrets?.clientSecret);
  if (!clientId || !clientSecret) throw new Error('Connection missing client credentials');

  const ctx: ProviderContext = {
    config,
    secrets,
    redirectUri: `${origin}/api/connectors/callback`,
  };

  const body = provider.buildTokenBody?.(ctx, code) || standardTokenBody(ctx, code);
  return {
    url: provider.tokenUrl(ctx),
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(provider.tokenHeaders || {}),
      },
      body: body.toString(),
    },
  };
}

export function refreshConnectorTokenRequest(connectionId: string, refreshToken: string, origin: string): { url: string; init: RequestInit } {
  const conn = getConnection(connectionId);
  if (!conn) throw new Error('Connection not found');
  const provider = getOAuthProviderDefinition(conn.type);
  if (!provider) throw new Error(`OAuth provider not supported for ${conn.type}`);

  const config = JSON.parse(conn.config || '{}') as Record<string, unknown>;
  const secrets = getConnectionSecrets(connectionId);
  const clientId = stringValue(config.clientId);
  const clientSecret = stringValue(secrets?.clientSecret);
  if (!clientId || !clientSecret) throw new Error('Connection missing client credentials');

  const ctx: ProviderContext = {
    config,
    secrets,
    redirectUri: `${origin}/api/connectors/callback`,
  };

  const body = provider.buildRefreshBody?.(ctx, refreshToken) || standardRefreshBody(ctx, refreshToken);
  return {
    url: provider.tokenUrl(ctx),
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(provider.tokenHeaders || {}),
      },
      body: body.toString(),
    },
  };
}

export function parseConnectorTokenResponse(connectionId: string, data: Record<string, any>): ParsedTokenResponse | null {
  const conn = getConnection(connectionId);
  if (!conn) return null;
  const provider = getOAuthProviderDefinition(conn.type);
  if (!provider) return null;
  return (provider.parseTokenResponse || defaultTokenParser)(data);
}
