import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { canAccessAgent, requireSignedIn } from '@/lib/api-guard';
import { isValidAgentId, safeJoinWithin } from '@/lib/security';

const WORKSPACES_BASE = path.resolve(process.cwd(), '../../workspaces');
const ALLOWED_FILES = ['SOUL.md', 'USER.md', 'TOOLS.md', 'ACTIVE.md'] as const;
type AllowedFile = typeof ALLOWED_FILES[number];

function readFileSafe(agentId: string, name: AllowedFile): string {
  const p = safeJoinWithin(WORKSPACES_BASE, agentId, name);
  if (!p) throw new Error('Invalid path');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

function writeFileSafe(agentId: string, name: AllowedFile, content: string): void {
  const p = safeJoinWithin(WORKSPACES_BASE, agentId, name);
  if (!p) throw new Error('Invalid path');
  fs.writeFileSync(p, content, 'utf8');
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireSignedIn();
    const agentId = request.nextUrl.searchParams.get('agentId') || actor.agentId;
    if (!agentId || !isValidAgentId(agentId)) {
      return NextResponse.json({ error: 'Invalid agentId' }, { status: 400 });
    }
    if (!canAccessAgent(actor, agentId)) {
      return NextResponse.json({ error: 'Forbidden', reason: 'ORG_MISMATCH' }, { status: 403 });
    }

    const files = {
      SOUL: readFileSafe(agentId, 'SOUL.md'),
      USER: readFileSafe(agentId, 'USER.md'),
      TOOLS: readFileSafe(agentId, 'TOOLS.md'),
      ACTIVE: readFileSafe(agentId, 'ACTIVE.md'),
    };

    return NextResponse.json({ agentId, files });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load personality files' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await requireSignedIn();
    const body = await request.json() as { agentId?: string; file: AllowedFile; content: string };

    const agentId = body.agentId || actor.agentId;
    if (!agentId || !isValidAgentId(agentId)) {
      return NextResponse.json({ error: 'Invalid agentId' }, { status: 400 });
    }
    if (!canAccessAgent(actor, agentId)) {
      return NextResponse.json({ error: 'Forbidden', reason: 'ORG_MISMATCH' }, { status: 403 });
    }
    if (!ALLOWED_FILES.includes(body.file)) {
      return NextResponse.json({ error: 'Invalid file target' }, { status: 400 });
    }
    if (typeof body.content !== 'string' || body.content.length > 200000) {
      return NextResponse.json({ error: 'Invalid content' }, { status: 400 });
    }

    writeFileSafe(agentId, body.file, body.content);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to update file' }, { status: 500 });
  }
}
