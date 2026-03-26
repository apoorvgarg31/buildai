import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const fsMem = new Map<string, string>();

vi.mock('fs', () => ({
  default: {
    existsSync: (p: string) => fsMem.has(p),
    readdirSync: (p: string) => {
      const prefix = `${p}/`;
      const names = new Set<string>();
      for (const k of fsMem.keys()) {
        if (k.startsWith(prefix)) names.add(k.slice(prefix.length));
      }
      return Array.from(names);
    },
    statSync: () => ({
      size: 42,
      mtime: new Date('2026-03-01T00:00:00Z'),
      isFile: () => true,
    }),
    readFileSync: (p: string) => Buffer.from(fsMem.get(p) || ''),
  },
}));

vi.mock('@/lib/security', () => ({
  isValidAgentId: vi.fn(() => true),
  safeJoinWithin: vi.fn((base: string, ...parts: string[]) => {
    if (base.startsWith('/virtual/')) return `${base}/${parts.join('/')}`;
    return `/virtual/${parts.join('/')}`;
  }),
}));

vi.mock('@/lib/api-guard', () => ({
  requireSignedIn: vi.fn(async () => ({
    userId: 'u-1',
    role: 'user',
    agentId: 'agent-a',
    email: 'u@example.com',
  })),
  canAccessAgent: vi.fn(() => true),
}));

vi.mock('@/lib/admin-db', () => ({
  writeAuditEvent: vi.fn(),
}));

import { GET as listFiles } from '../src/app/api/files/route';
import { GET as listArtifacts } from '../src/app/api/artifacts/route';
import { canAccessAgent } from '@/lib/api-guard';

describe('file/artifact API isolation', () => {
  beforeEach(() => {
    fsMem.clear();
    vi.clearAllMocks();
    fsMem.set('/virtual/agent-a/files', 'DIR');
    fsMem.set('/virtual/agent-a/files/report.pdf', 'pdf');
    fsMem.set('/virtual/agent-a/artifacts', 'DIR');
    fsMem.set('/virtual/agent-a/artifacts/summary.txt', 'text');
  });

  it('denies mismatched agent access for files API', async () => {
    vi.mocked(canAccessAgent).mockReturnValueOnce(false);

    const req = { nextUrl: new URL('http://localhost/api/files?agentId=agent-b') } as unknown as NextRequest;
    const res = await listFiles(req);

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe('Forbidden');
  });

  it('denies mismatched agent access for artifacts API', async () => {
    vi.mocked(canAccessAgent).mockReturnValueOnce(false);

    const req = { nextUrl: new URL('http://localhost/api/artifacts?agentId=agent-b') } as unknown as NextRequest;
    const res = await listArtifacts(req);

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe('Forbidden');
  });

  it('allows assigned-agent access for files/artifacts list APIs', async () => {
    const filesRes = await listFiles({ nextUrl: new URL('http://localhost/api/files?agentId=agent-a') } as unknown as NextRequest);
    const artifactsRes = await listArtifacts({ nextUrl: new URL('http://localhost/api/artifacts?agentId=agent-a') } as unknown as NextRequest);

    expect(filesRes.status).toBe(200);
    expect(artifactsRes.status).toBe(200);
  });
});
