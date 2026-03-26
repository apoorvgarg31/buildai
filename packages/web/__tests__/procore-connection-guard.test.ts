import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const authMock = vi.hoisted(() => vi.fn());
const userHasAssignedConnectionMock = vi.hoisted(() => vi.fn());
const getConnectionSecretsMock = vi.hoisted(() => vi.fn());
const getConnectionMock = vi.hoisted(() => vi.fn());

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

import { GET as tokenRoute } from '../src/app/api/procore/token/route';
import { GET as authRoute } from '../src/app/api/procore/auth/route';
import { GET as callbackRoute } from '../src/app/api/procore/callback/route';

describe('procore connection guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: 'user-1' });
    userHasAssignedConnectionMock.mockReturnValue(true);
    getConnectionSecretsMock.mockReturnValue({ clientSecret: 'stored-secret' });
    getConnectionMock.mockReturnValue({
      id: 'conn-1',
      type: 'procore',
      config: JSON.stringify({
        clientId: 'client-1',
        oauthBaseUrl: 'https://login.procore.com',
      }),
    });
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
      if (sql.includes('SELECT config FROM connections')) {
        return {
          get: () => ({
            config: JSON.stringify({
              clientId: 'client-1',
              oauthBaseUrl: 'https://login.procore.com',
            }),
          }),
        };
      }
      if (sql.includes('UPDATE user_tokens SET access_token')) {
        return { run: () => ({ changes: 1 }) };
      }
      return { get: () => undefined, run: () => ({ changes: 0 }) };
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      json: async () => ({
        access_token: 'fresh-token',
        refresh_token: 'fresh-refresh',
        token_type: 'Bearer',
        expires_in: 7200,
      }),
    })) as typeof fetch);
  });

  it('rejects token access for connections not assigned to the current user', async () => {
    userHasAssignedConnectionMock.mockReturnValue(false);

    const req = {
      nextUrl: new URL('http://localhost/api/procore/token?connectionId=conn-1'),
    } as NextRequest;

    const res = await tokenRoute(req);

    expect(res.status).toBe(403);
  });

  it('refreshes tokens using the encrypted connection secret store', async () => {
    const req = {
      nextUrl: new URL('http://localhost/api/procore/token?connectionId=conn-1'),
    } as NextRequest;

    const res = await tokenRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      'https://login.procore.com/oauth/token',
      expect.objectContaining({
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: 'client-1',
          client_secret: 'stored-secret',
          refresh_token: 'refresh-1',
        }),
      })
    );
    expect(data).toMatchObject({
      authorized: true,
      token_type: 'Bearer',
    });
    expect(data.access_token).toBeUndefined();
  });

  it('rejects auth redirects for unassigned connections', async () => {
    userHasAssignedConnectionMock.mockReturnValue(false);

    const req = {
      nextUrl: new URL('http://localhost/api/procore/auth?connectionId=conn-1'),
    } as NextRequest;

    const res = await authRoute(req);

    expect(res.status).toBe(403);
  });

  it('binds auth redirects to a browser state cookie', async () => {
    const req = {
      nextUrl: new URL('http://localhost/api/procore/auth?connectionId=conn-1'),
    } as NextRequest;

    const res = await authRoute(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('https://login.procore.com/oauth/authorize');
    expect(res.headers.get('set-cookie')).toContain('buildai_procore_oauth_state=');
  });

  it('rejects callback requests when the oauth state cookie is missing', async () => {
    const req = {
      nextUrl: new URL('http://localhost/api/procore/callback?code=code-1&state=state-1'),
      cookies: {
        get: vi.fn(() => undefined),
      },
    } as unknown as NextRequest;

    const res = await callbackRoute(req);
    const html = await res.text();

    expect(html).toContain('Invalid or expired OAuth state');
  });

  it('rejects callback requests when the oauth state belongs to another user', async () => {
    const cookieValue = Buffer.from(JSON.stringify({
      state: 'state-1',
      userId: 'user-2',
      connectionId: 'conn-1',
      issuedAt: Date.now(),
    })).toString('base64url');
    const req = {
      nextUrl: new URL('http://localhost/api/procore/callback?code=code-1&state=state-1'),
      cookies: {
        get: vi.fn(() => ({ value: cookieValue })),
      },
    } as unknown as NextRequest;

    const res = await callbackRoute(req);
    const html = await res.text();

    expect(html).toContain('OAuth state does not match the current user');
  });
});
