import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
const getDbMock = vi.hoisted(() => vi.fn());

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

vi.mock('@/lib/admin-db-server', () => ({
  getDb: getDbMock,
}));

describe('api-guard superadmin/authz behavior (OA-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC-OA2-10: requireSuperadmin currently delegates to admin role policy (placeholder behavior).
  it('AC-OA2-10 requireSuperadmin allows admin actor', async () => {
    authMock.mockResolvedValue({ userId: 'u-admin' });
    getDbMock.mockReturnValue({
      prepare: () => ({
        get: () => ({ id: 'u-admin', role: 'admin', agent_id: 'agent-1', email: 'admin@example.com' }),
      }),
    });

    const guard = await import('../src/lib/api-guard');
    const actor = await guard.requireSuperadmin();

    expect(actor.userId).toBe('u-admin');
    expect(actor.role).toBe('admin');
  });

  // AC-OA2-11: requireSuperadmin rejects non-admin users with FORBIDDEN.
  it('AC-OA2-11 requireSuperadmin rejects non-admin users', async () => {
    authMock.mockResolvedValue({ userId: 'u-user' });
    getDbMock.mockReturnValue({
      prepare: () => ({
        get: () => ({ id: 'u-user', role: 'user', agent_id: null, email: 'user@example.com' }),
      }),
    });

    const guard = await import('../src/lib/api-guard');
    await expect(guard.requireSuperadmin()).rejects.toThrow('FORBIDDEN');
  });

  // AC-OA2-12: requireSignedIn/requireSuperadmin reject missing auth with UNAUTHENTICATED.
  it('AC-OA2-12 requireSuperadmin rejects missing session', async () => {
    authMock.mockResolvedValue({ userId: null });
    const guard = await import('../src/lib/api-guard');
    await expect(guard.requireSuperadmin()).rejects.toThrow('UNAUTHENTICATED');
  });

  // AC-OA2-13 / P5-US-03: canAccessAgent keeps tenant/resource guard semantics (admin all, user own only).
  it('AC-OA2-13 canAccessAgent preserves positive/negative access semantics', async () => {
    const guard = await import('../src/lib/api-guard');

    expect(guard.canAccessAgent({ userId: 'a', role: 'admin', agentId: null, email: '' }, 'any-agent')).toBe(true);
    expect(guard.canAccessAgent({ userId: 'u', role: 'user', agentId: 'agent-1', email: '' }, 'agent-1')).toBe(true);
    expect(guard.canAccessAgent({ userId: 'u', role: 'user', agentId: 'agent-1', email: '' }, 'agent-2')).toBe(false);
  });
});
