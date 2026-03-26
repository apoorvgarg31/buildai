import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const authMock = vi.hoisted(() => vi.fn());
const userHasAssignedConnectionMock = vi.hoisted(() => vi.fn());
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
  getConnectionSecrets: getConnectionSecretsMock,
}));

vi.mock('@/lib/admin-db-server', () => ({
  getDb: () => ({
    prepare: prepareMock,
  }),
}));

import { GET as tokenRoute } from '../src/app/api/procore/token/route';
import { GET as authRoute } from '../src/app/api/procore/auth/route';

describe('procore connection guard', () => {
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
      access_token: 'fresh-token',
    });
  });

  it('rejects auth redirects for unassigned connections', async () => {
    userHasAssignedConnectionMock.mockReturnValue(false);

    const req = {
      nextUrl: new URL('http://localhost/api/procore/auth?connectionId=conn-1'),
    } as NextRequest;

    const res = await authRoute(req);

    expect(res.status).toBe(403);
  });
});
