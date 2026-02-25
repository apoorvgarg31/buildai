import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { canAccessAgent, requireSignedIn } from '@/lib/api-guard';
import { isValidAgentId, safeJoinWithin } from '@/lib/security';

type WatchItem = {
  id: string;
  system: string;
  entityType: string;
  entityId: string;
  label: string;
  notify: 'change';
  createdAt: string;
};

const WORKSPACES_BASE = path.resolve(process.cwd(), '../../workspaces');

function watchlistPath(agentId: string): string {
  const p = safeJoinWithin(WORKSPACES_BASE, agentId, 'watchlist.json');
  if (!p) throw new Error('Invalid path');
  return p;
}

function heartbeatPath(agentId: string): string {
  const p = safeJoinWithin(WORKSPACES_BASE, agentId, 'HEARTBEAT.md');
  if (!p) throw new Error('Invalid path');
  return p;
}

function readWatchlist(agentId: string): WatchItem[] {
  const p = watchlistPath(agentId);
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as WatchItem[];
  } catch {
    return [];
  }
}

function writeWatchlist(agentId: string, items: WatchItem[]) {
  fs.writeFileSync(watchlistPath(agentId), JSON.stringify(items, null, 2));
}

function syncHeartbeat(agentId: string, items: WatchItem[]) {
  const p = heartbeatPath(agentId);
  const start = '<!-- WATCHLIST:START -->';
  const end = '<!-- WATCHLIST:END -->';

  const blockLines = [
    start,
    '## Watchlist (auto-generated)',
    'Check these user-tracked entities every heartbeat and alert only on meaningful changes.',
    ...items.map((i, idx) => `${idx + 1}. [${i.system}] ${i.entityType} ${i.entityId} — ${i.label}`),
    end,
  ];
  const block = `${blockLines.join('\n')}\n`;

  const current = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '# HEARTBEAT.md\n\n';
  if (current.includes(start) && current.includes(end)) {
    const re = new RegExp(`${start}[\\s\\S]*?${end}\\n?`, 'm');
    fs.writeFileSync(p, current.replace(re, block));
  } else {
    fs.writeFileSync(p, `${current.trimEnd()}\n\n${block}`);
  }
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireSignedIn();
    const agentId = request.nextUrl.searchParams.get('agentId') || actor.agentId;
    if (!agentId || !isValidAgentId(agentId)) return NextResponse.json({ error: 'Invalid agentId' }, { status: 400 });
    if (!canAccessAgent(actor, agentId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    return NextResponse.json({ items: readWatchlist(agentId) });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to load watchlist' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSignedIn();
    const body = await request.json() as Partial<WatchItem> & { agentId?: string };
    const agentId = body.agentId || actor.agentId;
    if (!agentId || !isValidAgentId(agentId)) return NextResponse.json({ error: 'Invalid agentId' }, { status: 400 });
    if (!canAccessAgent(actor, agentId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (!body.system || !body.entityType || !body.entityId) {
      return NextResponse.json({ error: 'system, entityType, entityId required' }, { status: 400 });
    }

    const items = readWatchlist(agentId);
    const id = `${body.system}:${body.entityType}:${body.entityId}`.toLowerCase();
    if (items.some((i) => i.id === id)) return NextResponse.json({ ok: true, duplicate: true, items });

    const item: WatchItem = {
      id,
      system: body.system.trim(),
      entityType: body.entityType.trim(),
      entityId: body.entityId.trim(),
      label: (body.label || `${body.entityType} ${body.entityId}`).trim(),
      notify: 'change',
      createdAt: new Date().toISOString(),
    };

    const updated = [item, ...items].slice(0, 100);
    writeWatchlist(agentId, updated);
    syncHeartbeat(agentId, updated);
    return NextResponse.json({ ok: true, item, items: updated });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to add watch item' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await requireSignedIn();
    const body = await request.json() as { agentId?: string; id?: string };
    const agentId = body.agentId || actor.agentId;
    if (!agentId || !isValidAgentId(agentId)) return NextResponse.json({ error: 'Invalid agentId' }, { status: 400 });
    if (!canAccessAgent(actor, agentId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const items = readWatchlist(agentId);
    const updated = items.filter((i) => i.id !== body.id);
    writeWatchlist(agentId, updated);
    syncHeartbeat(agentId, updated);
    return NextResponse.json({ ok: true, items: updated });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to remove watch item' }, { status: 500 });
  }
}
