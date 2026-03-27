import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const requireSignedInMock = vi.hoisted(() => vi.fn());
const canAccessAgentMock = vi.hoisted(() => vi.fn(() => true));
const getMarketplaceSkillMock = vi.hoisted(() => vi.fn());
const generateInstallTokenMock = vi.hoisted(() => vi.fn(() => 'install-token'));
const deleteUserSkillInstallMock = vi.hoisted(() => vi.fn(() => true));
const isValidAgentIdMock = vi.hoisted(() => vi.fn(() => true));
const safeJoinWithinMock = vi.hoisted(() => vi.fn(() => '/tmp/workspaces/agent-1/skills/pdf'));
const fsMock = vi.hoisted(() => ({
  existsSync: vi.fn(() => true),
  rmSync: vi.fn(),
}));

vi.mock('@/lib/api-guard', () => ({
  requireSignedIn: requireSignedInMock,
  canAccessAgent: canAccessAgentMock,
}));

vi.mock('@/lib/marketplace', () => ({
  getMarketplaceSkill: getMarketplaceSkillMock,
  generateInstallToken: generateInstallTokenMock,
}));

vi.mock('@/lib/admin-db', () => ({
  deleteUserSkillInstall: deleteUserSkillInstallMock,
}));

vi.mock('@/lib/security', () => ({
  isValidAgentId: isValidAgentIdMock,
  safeJoinWithin: safeJoinWithinMock,
}));

vi.mock('fs', () => ({
  default: fsMock,
}));

import { DELETE, GET } from '../src/app/api/marketplace/skills/[id]/route';

describe('/api/marketplace/skills/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSignedInMock.mockResolvedValue({
      userId: 'user-1',
      role: 'user',
      agentId: 'agent-1',
      email: 'user@example.com',
    });
    getMarketplaceSkillMock.mockReturnValue({
      id: 'pdf',
      name: 'PDF',
      description: 'PDF tools',
      readme: '# PDF',
    });
  });

  it('returns skill detail and a signed install URL for an allowed agent', async () => {
    const req = { nextUrl: new URL('http://localhost/api/marketplace/skills/pdf?agentId=agent-1') } as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: 'pdf' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(generateInstallTokenMock).toHaveBeenCalledWith('pdf', 'agent-1');
    expect(data.installToken).toBe('install-token');
    expect(String(data.installUrl)).toContain('/api/marketplace/skills/pdf/install?token=install-token');
  });

  it('returns 404 when the requested skill does not exist', async () => {
    getMarketplaceSkillMock.mockReturnValueOnce(undefined);

    const req = { nextUrl: new URL('http://localhost/api/marketplace/skills/missing') } as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: 'missing' }) });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Skill not found' });
  });

  it('removes an installed skill from the user workspace', async () => {
    const req = { nextUrl: new URL('http://localhost/api/marketplace/skills/pdf?agentId=agent-1') } as NextRequest;
    const res = await DELETE(req, { params: Promise.resolve({ id: 'pdf' }) });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(deleteUserSkillInstallMock).toHaveBeenCalledWith('user-1', 'pdf');
    expect(fsMock.rmSync).toHaveBeenCalledWith('/tmp/workspaces/agent-1/skills/pdf', { recursive: true, force: true });
  });

  it('rejects skill removal when no agent id can be resolved', async () => {
    requireSignedInMock.mockResolvedValueOnce({ userId: 'user-1', role: 'user', agentId: null, email: 'user@example.com' });

    const req = { nextUrl: new URL('http://localhost/api/marketplace/skills/pdf') } as NextRequest;
    const res = await DELETE(req, { params: Promise.resolve({ id: 'pdf' }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.code).toBe('validation_error');
  });

  it('rejects skill removal for invalid agent ids', async () => {
    isValidAgentIdMock.mockReturnValueOnce(false);

    const req = { nextUrl: new URL('http://localhost/api/marketplace/skills/pdf?agentId=../agent-1') } as NextRequest;
    const res = await DELETE(req, { params: Promise.resolve({ id: 'pdf' }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.code).toBe('validation_error');
  });

  it('rejects skill removal when the actor cannot access the target agent', async () => {
    canAccessAgentMock.mockReturnValueOnce(false);

    const req = { nextUrl: new URL('http://localhost/api/marketplace/skills/pdf?agentId=agent-2') } as NextRequest;
    const res = await DELETE(req, { params: Promise.resolve({ id: 'pdf' }) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.code).toBe('forbidden_agent_access');
  });

  it('returns 401 when removing a skill without authentication', async () => {
    requireSignedInMock.mockRejectedValueOnce(new Error('UNAUTHENTICATED'));

    const req = { nextUrl: new URL('http://localhost/api/marketplace/skills/pdf?agentId=agent-1') } as NextRequest;
    const res = await DELETE(req, { params: Promise.resolve({ id: 'pdf' }) });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.code).toBe('unauthenticated');
  });

  it('returns 500 when skill removal fails unexpectedly', async () => {
    deleteUserSkillInstallMock.mockImplementationOnce(() => {
      throw new Error('db offline');
    });

    const req = { nextUrl: new URL('http://localhost/api/marketplace/skills/pdf?agentId=agent-1') } as NextRequest;
    const res = await DELETE(req, { params: Promise.resolve({ id: 'pdf' }) });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.code).toBe('internal_error');
  });
});
