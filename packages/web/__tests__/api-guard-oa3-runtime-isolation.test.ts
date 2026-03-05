import { beforeEach, describe, expect, it, vi } from 'vitest';

type UserRow = { id: string; role: 'admin' | 'user'; agent_id: string | null; email: string; org_id: string | null };

const authMock = vi.hoisted(() => vi.fn());
const getDbMock = vi.hoisted(() => vi.fn());

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('@/lib/admin-db-server', () => ({ getDb: getDbMock }));

const users = new Map<string, UserRow>();
const orgMemberships = new Map<string, string[]>();
const agentOrg = new Map<string, string | null>();

function buildDb() {
  return {
    prepare: (sql: string) => {
      if (sql.includes('FROM users')) {
        return {
          get: (userId: string) => users.get(userId),
        };
      }
      if (sql.includes('FROM organization_memberships')) {
        return {
          all: (userId: string) => (orgMemberships.get(userId) || []).map((organization_id) => ({ organization_id })),
        };
      }
      if (sql.includes('SELECT org_id FROM agents')) {
        return {
          get: (agentId: string) => ({ org_id: agentOrg.get(agentId) ?? null }),
        };
      }
      return {
        get: () => undefined,
        all: () => [],
      };
    },
  };
}

describe('OA-3 runtime isolation in api-guard', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    users.clear();
    orgMemberships.clear();
    agentOrg.clear();
    getDbMock.mockImplementation(() => buildDb());
  });

  it('AC-OA3-01 denies cross-org access', async () => {
    const guard = await import('../src/lib/api-guard');

    const actor = {
      userId: 'u-1',
      role: 'user' as const,
      agentId: 'agent-a',
      email: 'u1@example.com',
      isSuperadmin: false,
      orgId: 'org-a',
    };

    orgMemberships.set('u-1', ['org-a']);
    agentOrg.set('agent-b', 'org-b');

    expect(guard.canAccessAgent(actor, 'agent-b')).toBe(false);
    expect(() => guard.assertCanAccessAgent(actor, 'agent-b')).toThrow('FORBIDDEN_ORG_MISMATCH');
  });

  it('AC-OA3-02 allows org-aligned access for admin', async () => {
    const guard = await import('../src/lib/api-guard');

    const actor = {
      userId: 'admin-1',
      role: 'admin' as const,
      agentId: null,
      email: 'admin@example.com',
      isSuperadmin: false,
      orgId: 'org-a',
    };

    orgMemberships.set('admin-1', ['org-a']);
    agentOrg.set('agent-in-org-a', 'org-a');

    expect(guard.canAccessAgent(actor, 'agent-in-org-a')).toBe(true);
    expect(() => guard.assertCanAccessAgent(actor, 'agent-in-org-a')).not.toThrow();
  });

  it('AC-OA3-03 denies access for agent-org mismatch even if actor is authenticated', async () => {
    authMock.mockResolvedValue({ userId: 'u-mismatch' });
    users.set('u-mismatch', {
      id: 'u-mismatch',
      role: 'user',
      agent_id: 'agent-in-org-a',
      email: 'mismatch@example.com',
      org_id: 'org-a',
    });
    orgMemberships.set('u-mismatch', ['org-a']);
    agentOrg.set('agent-in-org-a', 'org-a');
    agentOrg.set('agent-in-org-b', 'org-b');

    const guard = await import('../src/lib/api-guard');
    const actor = await guard.requireSignedIn();

    expect(actor.userId).toBe('u-mismatch');
    expect(guard.canAccessAgent(actor, 'agent-in-org-b')).toBe(false);
    expect(() => guard.assertCanAccessAgent(actor, 'agent-in-org-b')).toThrow('FORBIDDEN_ORG_MISMATCH');
  });
});
