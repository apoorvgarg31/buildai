import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDbMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/admin-db-server', () => ({ getDb: getDbMock }));

describe('OA-3.5 org role model and agent management guards', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('allows maintainer to manage agent in same org', async () => {
    getDbMock.mockReturnValue({
      prepare: (sql: string) => {
        if (sql.includes('FROM agents')) return { get: () => ({ org_id: 'org-a' }) };
        if (sql.includes('FROM organization_memberships WHERE user_id')) return { all: () => [{ organization_id: 'org-a' }] };
        if (sql.includes('FROM organization_memberships WHERE organization_id')) return { get: () => ({ role: 'maintainer' }) };
        return { get: () => undefined, all: () => [] };
      },
    });

    const guard = await import('../src/lib/api-guard');
    const actor = { userId: 'u1', role: 'admin' as const, agentId: null, email: '', isSuperadmin: false, orgId: 'org-a' };
    expect(() => guard.assertCanManageAgent(actor, 'agent-a')).not.toThrow();
  });

  it('denies reviewer from managing agent', async () => {
    getDbMock.mockReturnValue({
      prepare: (sql: string) => {
        if (sql.includes('FROM agents')) return { get: () => ({ org_id: 'org-a' }) };
        if (sql.includes('FROM organization_memberships WHERE user_id')) return { all: () => [{ organization_id: 'org-a' }] };
        if (sql.includes('FROM organization_memberships WHERE organization_id')) return { get: () => ({ role: 'reviewer' }) };
        return { get: () => undefined, all: () => [] };
      },
    });

    const guard = await import('../src/lib/api-guard');
    const actor = { userId: 'u2', role: 'admin' as const, agentId: null, email: '', isSuperadmin: false, orgId: 'org-a' };
    expect(() => guard.assertCanManageAgent(actor, 'agent-a')).toThrow('FORBIDDEN_ORG_ROLE');
  });
});
