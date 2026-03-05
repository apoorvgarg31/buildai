import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
const getDbMock = vi.hoisted(() => vi.fn());

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

vi.mock('@/lib/admin-db-server', () => ({
  getDb: getDbMock,
}));

describe('api-guard superadmin/authz behavior (OA-2/OA-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AC-OA2-10 requireSuperadmin allows admin actor', async () => {
    authMock.mockResolvedValue({ userId: 'u-admin' });
    getDbMock.mockReturnValue({
      prepare: () => ({
        get: () => ({ id: 'u-admin', role: 'admin', agent_id: 'agent-1', email: 'admin@example.com', org_id: null }),
      }),
    });

    const guard = await import('../src/lib/api-guard');
    const actor = await guard.requireSuperadmin();

    expect(actor.userId).toBe('u-admin');
    expect(actor.role).toBe('admin');
  });

  it('AC-OA2-11 requireSuperadmin rejects non-admin users', async () => {
    authMock.mockResolvedValue({ userId: 'u-user' });
    getDbMock.mockReturnValue({
      prepare: () => ({
        get: () => ({ id: 'u-user', role: 'user', agent_id: null, email: 'user@example.com', org_id: null }),
      }),
    });

    const guard = await import('../src/lib/api-guard');
    await expect(guard.requireSuperadmin()).rejects.toThrow('FORBIDDEN');
  });

  it('AC-OA2-12 requireSuperadmin rejects missing session', async () => {
    authMock.mockResolvedValue({ userId: null });
    const guard = await import('../src/lib/api-guard');
    await expect(guard.requireSuperadmin()).rejects.toThrow('UNAUTHENTICATED');
  });

  it('AC-OA2-13 canAccessAgent preserves positive/negative access semantics', async () => {
    const guard = await import('../src/lib/api-guard');

    getDbMock.mockReturnValue({
      prepare: (sql: string) => {
        if (sql.includes('FROM organization_memberships')) {
          return { all: () => [] };
        }
        if (sql.includes('SELECT org_id FROM agents')) {
          return { get: () => ({ org_id: null }) };
        }
        return { get: () => undefined, all: () => [] };
      },
    });

    expect(guard.canAccessAgent({ userId: 'a', role: 'admin', agentId: null, email: '', isSuperadmin: false, orgId: null }, 'any-agent')).toBe(true);
    expect(guard.canAccessAgent({ userId: 'u', role: 'user', agentId: 'agent-1', email: '', isSuperadmin: false, orgId: null }, 'agent-1')).toBe(true);
    expect(guard.canAccessAgent({ userId: 'u', role: 'user', agentId: 'agent-1', email: '', isSuperadmin: false, orgId: null }, 'agent-2')).toBe(false);
  });
});
