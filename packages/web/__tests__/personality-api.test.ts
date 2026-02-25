import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mem = new Map<string, string>();

vi.mock('fs', () => ({
  default: {
    existsSync: (p: string) => mem.has(p),
    readFileSync: (p: string) => mem.get(p) || '',
    writeFileSync: (p: string, c: string) => {
      mem.set(p, c);
    },
  },
}));

vi.mock('@/lib/api-guard', () => ({
  requireSignedIn: vi.fn(async () => ({ userId: 'u1', role: 'user', agentId: 'agent-a', email: 'u@example.com' })),
  canAccessAgent: vi.fn(() => true),
}));

vi.mock('@/lib/security', () => ({
  isValidAgentId: vi.fn(() => true),
  safeJoinWithin: vi.fn((_base: string, ...parts: string[]) => `/virtual/${parts.join('/')}`),
}));

import { GET as filesGet, PUT as filesPut } from '../src/app/api/personality/files/route';
import { POST as updatePost } from '../src/app/api/personality/update/route';
import { requireSignedIn, canAccessAgent } from '@/lib/api-guard';
import { isValidAgentId } from '@/lib/security';

function req(method: 'GET' | 'PUT' | 'POST', body?: unknown): Request {
  return new Request('http://localhost/api/test', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('personality APIs', () => {
  beforeEach(() => {
    mem.clear();
    vi.clearAllMocks();
  });

  it('loads files through /api/personality/files', async () => {
    mem.set('/virtual/agent-a/SOUL.md', '# soul');
    mem.set('/virtual/agent-a/USER.md', '# user');

    const res = await filesGet({ nextUrl: new URL('http://localhost/api/personality/files?agentId=agent-a') } as unknown as NextRequest);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.files.SOUL).toContain('# soul');
    expect(data.files.USER).toContain('# user');
  });

  it('saves selected file through PUT', async () => {
    const res = await filesPut(req('PUT', {
      file: 'SOUL.md',
      content: 'updated soul',
    }) as unknown as NextRequest);

    expect(res.status).toBe(200);
    expect(mem.get('/virtual/agent-a/SOUL.md')).toBe('updated soul');
  });

  it('captures quick personality instruction', async () => {
    mem.set('/virtual/agent-a/USER.md', '# User');
    mem.set('/virtual/agent-a/ACTIVE.md', '# Active');

    const res = await updatePost(req('POST', {
      instruction: 'Be concise and proactive only for blockers',
    }) as unknown as NextRequest);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mem.get('/virtual/agent-a/USER.md')).toContain('Preference update');
    expect(mem.get('/virtual/agent-a/ACTIVE.md')).toContain('Personality tweak requested');
  });

  it('returns 400 for invalid file target and oversized content', async () => {
    const badFile = await filesPut(req('PUT', { file: 'BAD.md', content: 'x' }) as unknown as NextRequest);
    expect(badFile.status).toBe(400);

    const big = await filesPut(req('PUT', { file: 'SOUL.md', content: 'x'.repeat(200001) }) as unknown as NextRequest);
    expect(big.status).toBe(400);
  });

  it('returns 401/403/400 on auth-access-validation failures', async () => {
    vi.mocked(requireSignedIn).mockRejectedValueOnce(new Error('UNAUTHENTICATED'));
    const unauth = await filesGet({ nextUrl: new URL('http://localhost/api/personality/files?agentId=agent-a') } as unknown as NextRequest);
    expect(unauth.status).toBe(401);

    vi.mocked(canAccessAgent).mockReturnValueOnce(false);
    const forbidden = await filesGet({ nextUrl: new URL('http://localhost/api/personality/files?agentId=agent-a') } as unknown as NextRequest);
    expect(forbidden.status).toBe(403);

    vi.mocked(isValidAgentId).mockReturnValueOnce(false);
    const invalid = await filesGet({ nextUrl: new URL('http://localhost/api/personality/files?agentId=bad') } as unknown as NextRequest);
    expect(invalid.status).toBe(400);
  });

  it('returns 400 for empty quick update instruction', async () => {
    const res = await updatePost(req('POST', { instruction: '   ' }) as unknown as NextRequest);
    expect(res.status).toBe(400);
  });
});
