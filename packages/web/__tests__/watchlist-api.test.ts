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

import { DELETE, GET, POST } from '../src/app/api/watchlist/route';
import { requireSignedIn, canAccessAgent } from '@/lib/api-guard';
import { isValidAgentId } from '@/lib/security';

function req(method: 'GET' | 'POST' | 'DELETE', body?: unknown, query = ''): Request {
  return new Request(`http://localhost/api/watchlist${query}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/watchlist', () => {
  beforeEach(() => {
    mem.clear();
    vi.clearAllMocks();
  });

  it('adds item and syncs heartbeat block', async () => {
    const res = await POST(req('POST', {
      system: 'Procore',
      entityType: 'RFI',
      entityId: '102',
      label: 'RFI 102',
    }) as unknown as NextRequest);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.items.length).toBe(1);

    const hb = mem.get('/virtual/agent-a/HEARTBEAT.md') || '';
    expect(hb).toContain('<!-- WATCHLIST:START -->');
    expect(hb).toContain('[Procore] RFI 102');
  });

  it('lists items via GET', async () => {
    await POST(req('POST', { system: 'Procore', entityType: 'RFI', entityId: '5' }) as unknown as NextRequest);
    const res = await GET({ nextUrl: new URL('http://localhost/api/watchlist?agentId=agent-a') } as unknown as NextRequest);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items[0].entityId).toBe('5');
  });

  it('removes item and rewrites heartbeat block', async () => {
    const add = await POST(req('POST', { system: 'Procore', entityType: 'RFI', entityId: '9' }) as unknown as NextRequest);
    const addData = await add.json();
    const id = addData.items[0].id;

    const del = await DELETE(req('DELETE', { id }) as unknown as NextRequest);
    const data = await del.json();

    expect(del.status).toBe(200);
    expect(data.items.length).toBe(0);

    const hb = mem.get('/virtual/agent-a/HEARTBEAT.md') || '';
    expect(hb).toContain('Watchlist (auto-generated)');
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requireSignedIn).mockRejectedValueOnce(new Error('UNAUTHENTICATED'));
    const res = await GET({ nextUrl: new URL('http://localhost/api/watchlist?agentId=agent-a') } as unknown as NextRequest);
    expect(res.status).toBe(401);
  });

  it('returns 403 when agent access is forbidden', async () => {
    vi.mocked(canAccessAgent).mockReturnValueOnce(false);
    const res = await GET({ nextUrl: new URL('http://localhost/api/watchlist?agentId=agent-a') } as unknown as NextRequest);
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid agentId or missing required fields', async () => {
    vi.mocked(isValidAgentId).mockReturnValueOnce(false);
    const badAgent = await GET({ nextUrl: new URL('http://localhost/api/watchlist?agentId=bad') } as unknown as NextRequest);
    expect(badAgent.status).toBe(400);

    const missingFields = await POST(req('POST', { system: 'Procore' }) as unknown as NextRequest);
    expect(missingFields.status).toBe(400);
  });

  it('returns 400 on delete without id', async () => {
    const res = await DELETE(req('DELETE', {}) as unknown as NextRequest);
    expect(res.status).toBe(400);
  });
});
