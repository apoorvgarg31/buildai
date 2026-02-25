import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const files = new Map<string, string>();

vi.mock('fs', () => ({
  default: {
    existsSync: (p: string) => files.has(p),
    readdirSync: (p: string) => {
      const prefix = `${p}/`;
      const names = new Set<string>();
      for (const k of files.keys()) {
        if (k.startsWith(prefix)) names.add(k.slice(prefix.length));
      }
      return Array.from(names);
    },
    statSync: () => ({ size: 123, mtime: new Date('2026-02-25T00:00:00Z') }),
    unlinkSync: (p: string) => { files.delete(p); },
    readFileSync: (p: string) => files.get(p) || '',
    writeFileSync: (p: string, c: string) => { files.set(p, c); },
  },
}));

vi.mock('@/lib/api-guard', () => ({
  requireSignedIn: vi.fn(async () => ({ userId: 'u1', role: 'user', agentId: 'agent-a', email: 'u@example.com' })),
  canAccessAgent: vi.fn(() => true),
}));

vi.mock('@/lib/security', () => ({
  isValidAgentId: vi.fn(() => true),
  safeJoinWithin: vi.fn((base: string, ...parts: string[]) => {
    if (base.startsWith('/virtual/')) return `${base}/${parts.join('/')}`;
    return `/virtual/${parts.join('/')}`;
  }),
}));

import { GET as listFiles } from '../src/app/api/files/route';
import { DELETE as deleteFile } from '../src/app/api/files/[name]/route';
import { requireSignedIn, canAccessAgent } from '@/lib/api-guard';
import { isValidAgentId } from '@/lib/security';


describe('files api', () => {
  beforeEach(() => {
    files.clear();
    vi.clearAllMocks();
    files.set('/virtual/agent-a/files', 'DIR');
    files.set('/virtual/agent-a/files/test.pdf', 'pdfdata');
    files.set('/virtual/agent-a/files/test.extracted.json', '{"ok":true}');
  });

  it('lists files and marks extraction presence', async () => {
    const req = { nextUrl: new URL('http://localhost/api/files?agentId=agent-a') } as unknown as NextRequest;
    const res = await listFiles(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].name).toBe('test.pdf');
    expect(data[0].hasExtraction).toBe(true);
  });

  it('deletes file and extracted pair', async () => {
    const req = { nextUrl: new URL('http://localhost/api/files/test.pdf?agentId=agent-a') } as unknown as NextRequest;
    const res = await deleteFile(req, { params: Promise.resolve({ name: 'test.pdf' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(files.has('/virtual/agent-a/files/test.pdf')).toBe(false);
    expect(files.has('/virtual/agent-a/files/test.extracted.json')).toBe(false);
  });

  it('returns 401/403/400/404 for common failure cases', async () => {
    vi.mocked(requireSignedIn).mockRejectedValueOnce(new Error('UNAUTHENTICATED'));
    const unauth = await listFiles({ nextUrl: new URL('http://localhost/api/files?agentId=agent-a') } as unknown as NextRequest);
    expect(unauth.status).toBe(401);

    vi.mocked(canAccessAgent).mockReturnValueOnce(false);
    const forbidden = await listFiles({ nextUrl: new URL('http://localhost/api/files?agentId=agent-a') } as unknown as NextRequest);
    expect(forbidden.status).toBe(403);

    vi.mocked(isValidAgentId).mockReturnValueOnce(false);
    const invalid = await listFiles({ nextUrl: new URL('http://localhost/api/files?agentId=bad') } as unknown as NextRequest);
    expect(invalid.status).toBe(400);

    const missing = await deleteFile({ nextUrl: new URL('http://localhost/api/files/missing.pdf?agentId=agent-a') } as unknown as NextRequest, { params: Promise.resolve({ name: 'missing.pdf' }) });
    expect(missing.status).toBe(404);
  });
});
