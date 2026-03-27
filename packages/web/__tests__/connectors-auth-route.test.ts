import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const authMock = vi.hoisted(() => vi.fn());
const userHasAssignedConnectionMock = vi.hoisted(() => vi.fn());
const getConnectionMock = vi.hoisted(() => vi.fn());
const getConnectionSecretsMock = vi.hoisted(() => vi.fn());

type StatementResult = {
  get?: (...args: unknown[]) => unknown;
  run?: (...args: unknown[]) => unknown;
};

let prepareMock: ReturnType<typeof vi.fn>;

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

vi.mock('@/lib/api-guard', () => ({
  userHasAssignedConnection: userHasAssignedConnectionMock,
}));

vi.mock('@/lib/admin-db', () => ({
  getConnection: getConnectionMock,
  getConnectionSecrets: getConnectionSecretsMock,
}));

vi.mock('@/lib/admin-db-server', () => ({
  getDb: () => ({
    prepare: prepareMock,
  }),
}));

import { GET as authRoute } from '../src/app/api/connectors/auth/route';
import { GET as callbackRoute } from '../src/app/api/connectors/callback/route';
import { GET as tokenRoute } from '../src/app/api/connectors/token/route';

describe('generic connector auth lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: 'user-1' });
    userHasAssignedConnectionMock.mockReturnValue(true);
    getConnectionSecretsMock.mockReturnValue({ clientSecret: 'stored-secret' });
    prepareMock = vi.fn((sql: string): StatementResult => {
      if (sql.includes('SELECT access_token, refresh_token, token_type, expires_at FROM user_tokens')) {
        return {
          get: () => ({
            access_token: 'expired-token',
            refresh_token: 'refresh-1',
            token_type: 'Bearer',
            expires_at: 1,
          }),
        };
      }
      if (sql.includes('INSERT OR REPLACE INTO user_tokens')) {
        return { run: () => ({ changes: 1 }) };
      }
      if (sql.includes('UPDATE user_tokens SET access_token')) {
        return { run: () => ({ changes: 1 }) };
      }
      return { get: () => undefined, run: () => ({ changes: 0 }) };
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'fresh-token',
        refresh_token: 'fresh-refresh',
        token_type: 'Bearer',
        expires_in: 7200,
      }),
    })) as typeof fetch);
  });

  it('starts auth for a non-procore oauth connector and binds a browser state cookie', async () => {
    getConnectionMock.mockReturnValue({
      id: 'conn-linear',
      name: 'Linear',
      type: 'linear',
      auth_mode: 'oauth_user',
      config: JSON.stringify({ clientId: 'linear-client', scopes: ['issues:write', 'read'] }),
    });

    const req = { nextUrl: new URL('http://localhost/api/connectors/auth?connectionId=conn-linear') } as NextRequest;
    const res = await authRoute(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('https://linear.app/oauth/authorize');
    expect(res.headers.get('set-cookie')).toContain('buildai_connector_oauth_state=');
  });

  it('rejects auth for unsupported or non-oauth connectors', async () => {
    getConnectionMock.mockReturnValue({
      id: 'conn-db',
      name: 'Database',
      type: 'database',
      auth_mode: 'shared',
      config: JSON.stringify({}),
    });

    const req = { nextUrl: new URL('http://localhost/api/connectors/auth?connectionId=conn-db') } as NextRequest;
    const res = await authRoute(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Connection does not support user OAuth' });
  });

  it('stores oauth callback tokens for a generic connector', async () => {
    getConnectionMock.mockReturnValue({
      id: 'conn-google',
      name: 'Google Workspace',
      type: 'google_workspace',
      auth_mode: 'oauth_user',
      config: JSON.stringify({ clientId: 'google-client', scopes: ['openid', 'email'] }),
    });

    const cookieValue = Buffer.from(JSON.stringify({
      state: 'state-1',
      userId: 'user-1',
      connectionId: 'conn-google',
      issuedAt: Date.now(),
    })).toString('base64url');

    const req = {
      nextUrl: new URL('http://localhost/api/connectors/callback?code=code-1&state=state-1'),
      cookies: { get: vi.fn(() => ({ value: cookieValue })) },
    } as unknown as NextRequest;

    const res = await callbackRoute(req);
    const html = await res.text();

    expect(html).toContain('Google Workspace connected');
    expect(fetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(prepareMock).toHaveBeenCalledWith(expect.stringContaining('INSERT OR REPLACE INTO user_tokens'));
  });

  it('rejects callback requests when the oauth state is expired', async () => {
    getConnectionMock.mockReturnValue({
      id: 'conn-github',
      name: 'GitHub',
      type: 'github',
      auth_mode: 'oauth_user',
      config: JSON.stringify({ clientId: 'github-client' }),
    });

    const cookieValue = Buffer.from(JSON.stringify({
      state: 'state-1',
      userId: 'user-1',
      connectionId: 'conn-github',
      issuedAt: Date.now() - (11 * 60 * 1000),
    })).toString('base64url');

    const req = {
      nextUrl: new URL('http://localhost/api/connectors/callback?code=code-1&state=state-1'),
      cookies: { get: vi.fn(() => ({ value: cookieValue })) },
    } as unknown as NextRequest;

    const res = await callbackRoute(req);
    const html = await res.text();

    expect(html).toContain('OAuth state expired');
  });

  it('reports missing authorization for a generic oauth connector', async () => {
    getConnectionMock.mockReturnValue({
      id: 'conn-slack',
      name: 'Slack',
      type: 'slack',
      auth_mode: 'oauth_user',
      config: JSON.stringify({ clientId: 'slack-client' }),
    });
    prepareMock = vi.fn((sql: string): StatementResult => {
      if (sql.includes('SELECT access_token, refresh_token, token_type, expires_at FROM user_tokens')) {
        return { get: () => undefined };
      }
      return { get: () => undefined, run: () => ({ changes: 0 }) };
    });

    const req = { nextUrl: new URL('http://localhost/api/connectors/token?connectionId=conn-slack') } as NextRequest;
    const res = await tokenRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toMatchObject({
      authorized: false,
      authUrl: '/api/connectors/auth?connectionId=conn-slack',
    });
  });

  it('refreshes an expired oauth token for a generic connector', async () => {
    getConnectionMock.mockReturnValue({
      id: 'conn-hubspot',
      name: 'HubSpot',
      type: 'hubspot',
      auth_mode: 'oauth_user',
      config: JSON.stringify({ clientId: 'hubspot-client' }),
    });

    const req = { nextUrl: new URL('http://localhost/api/connectors/token?connectionId=conn-hubspot') } as NextRequest;
    const res = await tokenRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toMatchObject({ authorized: true, refreshed: true });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.hubapi.com/oauth/v1/token',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('forces reconnect when an expired oauth token has no refresh token', async () => {
    getConnectionMock.mockReturnValue({
      id: 'conn-github',
      name: 'GitHub',
      type: 'github',
      auth_mode: 'oauth_user',
      config: JSON.stringify({ clientId: 'github-client' }),
    });
    prepareMock = vi.fn((sql: string): StatementResult => {
      if (sql.includes('SELECT access_token, refresh_token, token_type, expires_at FROM user_tokens')) {
        return {
          get: () => ({
            access_token: 'expired-token',
            refresh_token: null,
            token_type: 'Bearer',
            expires_at: 1,
          }),
        };
      }
      return { get: () => undefined, run: () => ({ changes: 0 }) };
    });

    const req = { nextUrl: new URL('http://localhost/api/connectors/token?connectionId=conn-github') } as NextRequest;
    const res = await tokenRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toMatchObject({
      authorized: false,
      expired: true,
      authUrl: '/api/connectors/auth?connectionId=conn-github',
    });
  });

  it('surfaces refresh failures cleanly for generic connectors', async () => {
    getConnectionMock.mockReturnValue({
      id: 'conn-ms',
      name: 'Microsoft 365',
      type: 'microsoft365',
      auth_mode: 'oauth_user',
      config: JSON.stringify({ clientId: 'ms-client', tenantId: 'common' }),
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_grant' }),
    })) as typeof fetch);

    const req = { nextUrl: new URL('http://localhost/api/connectors/token?connectionId=conn-ms') } as NextRequest;
    const res = await tokenRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toMatchObject({
      authorized: false,
      expired: true,
      authUrl: '/api/connectors/auth?connectionId=conn-ms',
    });
    expect(data.message).toContain('Token refresh failed');
  });
});
