import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireSignedInMock = vi.hoisted(() => vi.fn());
const canAccessAgentMock = vi.hoisted(() => vi.fn(() => true));
const getDbMock = vi.hoisted(() => vi.fn());
const verifyInstallTokenMock = vi.hoisted(() => vi.fn());
const getMarketplaceSkillMock = vi.hoisted(() => vi.fn());
const packageSkillMock = vi.hoisted(() => vi.fn());
const safeJoinWithinMock = vi.hoisted(() => vi.fn(() => '/tmp/workspaces/agent-a/skills/buildai-procore'));
const isValidAgentIdMock = vi.hoisted(() => vi.fn(() => true));
const upsertUserSkillInstallMock = vi.hoisted(() => vi.fn());
const buildSkillInstallInstructionsMock = vi.hoisted(() => vi.fn(() => 'Install skill instructions'));
const resolveSkillConnectionRequirementsMock = vi.hoisted(() => vi.fn(() => ({
  requirementStates: [],
  requirementsSatisfied: true,
})));
const fsMock = vi.hoisted(() => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(() => []),
  copyFileSync: vi.fn(),
  rmSync: vi.fn(),
}));

vi.mock('@/lib/api-guard', () => ({
  requireSignedIn: requireSignedInMock,
  canAccessAgent: canAccessAgentMock,
}));

vi.mock('@/lib/security', () => ({
  isValidAgentId: isValidAgentIdMock,
  safeJoinWithin: safeJoinWithinMock,
}));

vi.mock('@/lib/admin-db', () => ({
  upsertUserSkillInstall: upsertUserSkillInstallMock,
}));

vi.mock('@/lib/connector-runtime', () => ({
  buildSkillInstallInstructions: buildSkillInstallInstructionsMock,
  resolveSkillConnectionRequirements: resolveSkillConnectionRequirementsMock,
}));

vi.mock('@/lib/admin-db-server', () => ({
  getDb: getDbMock,
}));

vi.mock('@/lib/marketplace', () => ({
  verifyInstallToken: verifyInstallTokenMock,
  getMarketplaceSkill: getMarketplaceSkillMock,
  packageSkill: packageSkillMock,
}));

vi.mock('fs', () => ({
  default: fsMock,
}));

import { GET, POST } from '../src/app/api/marketplace/skills/[id]/install/route';

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
    canAccessAgentMock.mockReturnValue(true);
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
    isValidAgentIdMock.mockReturnValue(true);
    safeJoinWithinMock.mockReturnValue('/tmp/workspaces/agent-a/skills/buildai-procore');
    buildSkillInstallInstructionsMock.mockReturnValue('Install skill instructions');
    resolveSkillConnectionRequirementsMock.mockReturnValue({
      requirementStates: [],
      requirementsSatisfied: true,
    });
    fsMock.existsSync.mockReturnValue(true);
    fsMock.readdirSync.mockReturnValue([]);
  });

  it('rejects invalid JSON on POST before attempting install', async () => {
    const req = {
      json: vi.fn(async () => {
        throw new Error('bad json');
      }),
    } as never;

    const res = await POST(req, { params: Promise.resolve({ id: 'buildai-procore' }) });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid JSON body' });
    expect(requireSignedInMock).not.toHaveBeenCalled();
  });

  it('rejects install requests when token skill does not match the requested skill', async () => {
    verifyInstallTokenMock.mockReturnValue({ skillId: 'different-skill', agentId: 'agent-a' });

    const req = {
      json: vi.fn(async () => ({ token: 'test-token' })),
    } as never;

    const res = await POST(req, { params: Promise.resolve({ id: 'buildai-procore' }) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.code).toBe('forbidden');
    expect(String(data.error)).toContain('Token does not match');
  });

  it('rejects installs for invalid agent identifiers', async () => {
    isValidAgentIdMock.mockReturnValue(false);

    const req = {
      json: vi.fn(async () => ({ agentId: '../agent-a' })),
    } as never;

    const res = await POST(req, { params: Promise.resolve({ id: 'buildai-procore' }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.code).toBe('validation_error');
    expect(String(data.error)).toContain('Invalid agentId');
  });

  it('rejects installs when the signed-in actor cannot access the target agent', async () => {
    canAccessAgentMock.mockReturnValue(false);

    const req = {
      json: vi.fn(async () => ({ agentId: 'agent-b' })),
    } as never;

    const res = await POST(req, { params: Promise.resolve({ id: 'buildai-procore' }) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.code).toBe('forbidden_agent_access');
    expect(data.details).toEqual({ reason: 'AGENT_ACCESS_DENIED' });
  });

  it('installs a skill into the agent workspace and records the user install', async () => {
    getDbMock.mockReturnValue(createDb());

    const req = {
      json: vi.fn(async () => ({ agentId: 'agent-a' })),
    } as never;

    const res = await POST(req, { params: Promise.resolve({ id: 'buildai-procore' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.installedTo).toBe('workspaces/agent-a/skills/buildai-procore');
    expect(fsMock.mkdirSync).toHaveBeenCalled();
    expect(upsertUserSkillInstallMock).toHaveBeenCalledWith({
      userId: 'user-1',
      skillId: 'buildai-procore',
      source: 'public',
    });
  });


  it('reinstalls a skill by clearing the existing workspace copy first', async () => {
    getDbMock.mockReturnValue(createDb());
    fsMock.readdirSync
      .mockReturnValueOnce([{ name: 'SKILL.md', isDirectory: () => false }])
      .mockReturnValueOnce([{ name: 'SKILL.md', isDirectory: () => false }]);

    const req = {
      json: vi.fn(async () => ({ agentId: 'agent-a' })),
    } as never;

    const res = await POST(req, { params: Promise.resolve({ id: 'buildai-procore' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(fsMock.rmSync).toHaveBeenCalledWith('/tmp/workspaces/agent-a/skills/buildai-procore', { recursive: true, force: true });
    expect(fsMock.copyFileSync).toHaveBeenCalled();
  });

  it('rejects GET requests with an invalid agent id in the token payload', async () => {
    isValidAgentIdMock.mockReturnValue(false);

    const req = { nextUrl: new URL('http://localhost/api/marketplace/skills/buildai-procore/install?token=test-token') } as never;
    const res = await GET(req, { params: Promise.resolve({ id: 'buildai-procore' }) });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid agentId in token.' });
  });

  it('returns connector requirements that tell the agent admin setup is missing', async () => {
    getDbMock.mockReturnValue(createDb());
    resolveSkillConnectionRequirementsMock.mockReturnValue({
      requirementStates: [
        {
          type: 'procore',
          blockedReason: 'admin_setup_required',
          statusLabel: 'Admin setup needed',
        },
      ],
      requirementsSatisfied: false,
    });
    buildSkillInstallInstructionsMock.mockReturnValue('Ask your admin to configure this in Connectors.');

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
    resolveSkillConnectionRequirementsMock.mockReturnValue({
      requirementStates: [
        {
          type: 'procore',
          blockedReason: 'reconnect_required',
          reconnectRequired: true,
          statusLabel: 'Reconnect required',
          actionLabel: 'Reconnect account',
        },
      ],
      requirementsSatisfied: false,
    });
    buildSkillInstallInstructionsMock.mockReturnValue('Please reconnect this account from Connectors.');

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
