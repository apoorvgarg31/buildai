import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireSignedInMock = vi.hoisted(() => vi.fn());
const canAccessAgentMock = vi.hoisted(() => vi.fn(() => true));
const getDbMock = vi.hoisted(() => vi.fn());
const verifyInstallTokenMock = vi.hoisted(() => vi.fn());
const getMarketplaceSkillMock = vi.hoisted(() => vi.fn());
const packageSkillMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-guard', () => ({
  requireSignedIn: requireSignedInMock,
  canAccessAgent: canAccessAgentMock,
}));

vi.mock('@/lib/admin-db-server', () => ({
  getDb: getDbMock,
}));

vi.mock('@/lib/marketplace', () => ({
  verifyInstallToken: verifyInstallTokenMock,
  getMarketplaceSkill: getMarketplaceSkillMock,
  packageSkill: packageSkillMock,
}));

import { GET } from '../src/app/api/marketplace/skills/[id]/install/route';

type DbPrepareResult = {
  all?: (value?: unknown) => unknown;
  get?: (...values: unknown[]) => unknown;
};

function createDb(options?: {
  connections?: Array<{ id: string; name: string; type: string; auth_mode: 'shared' | 'oauth_user' | 'token_user'; status: string }>;
  tokenRows?: Array<{ connection_id: string; expires_at?: number | null }>;
}) {
  const connections = options?.connections || [];
  const tokenRows = options?.tokenRows || [];

  return {
    prepare(sql: string): DbPrepareResult {
      if (sql.includes('FROM connections c')) {
        return { all: () => connections };
      }

      if (sql.includes('SELECT connection_id, expires_at FROM user_tokens')) {
        return { all: () => tokenRows };
      }

      throw new Error(`Unexpected SQL in test: ${sql}`);
    },
  };
}

describe('/api/marketplace/skills/[id]/install', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSignedInMock.mockResolvedValue({ userId: 'user-1', role: 'user', agentId: 'agent-a', email: 'user@example.com' });
    verifyInstallTokenMock.mockReturnValue({ skillId: 'buildai-procore', agentId: 'agent-a' });
    getMarketplaceSkillMock.mockReturnValue({
      id: 'buildai-procore',
      name: 'Procore Integration',
      description: 'Syncs with Procore',
      version: '1.0.0',
      connectionType: 'procore',
    });
    packageSkillMock.mockReturnValue({
      id: 'buildai-procore',
      name: 'Procore Integration',
      files: [{ path: 'SKILL.md', content: '# Skill' }],
    });
  });

  it('returns connector requirements that tell the agent admin setup is missing', async () => {
    getDbMock.mockReturnValue(createDb());

    const req = { nextUrl: new URL('http://localhost/api/marketplace/skills/buildai-procore/install?token=test-token') } as never;
    const res = await GET(req, { params: Promise.resolve({ id: 'buildai-procore' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.requirementsSatisfied).toBe(false);
    expect(data.connectionRequirements).toEqual([
      expect.objectContaining({
        type: 'procore',
        blockedReason: 'admin_setup_required',
        statusLabel: 'Admin setup needed',
      }),
    ]);
    expect(String(data.instructions)).toContain('admin');
    expect(String(data.instructions)).toContain('Connectors');
  });

  it('returns reconnect guidance when user auth exists but is expired', async () => {
    getDbMock.mockReturnValue(createDb({
      connections: [
        {
          id: 'conn-procore',
          name: 'Procore Production',
          type: 'procore',
          auth_mode: 'oauth_user',
          status: 'connected',
        },
      ],
      tokenRows: [{ connection_id: 'conn-procore', expires_at: 1 }],
    }));

    const req = { nextUrl: new URL('http://localhost/api/marketplace/skills/buildai-procore/install?token=test-token') } as never;
    const res = await GET(req, { params: Promise.resolve({ id: 'buildai-procore' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.requirementsSatisfied).toBe(false);
    expect(data.connectionRequirements).toEqual([
      expect.objectContaining({
        type: 'procore',
        blockedReason: 'reconnect_required',
        reconnectRequired: true,
        statusLabel: 'Reconnect required',
        actionLabel: 'Reconnect account',
      }),
    ]);
    expect(String(data.instructions)).toContain('reconnect');
    expect(String(data.instructions)).toContain('Connectors');
  });
});
