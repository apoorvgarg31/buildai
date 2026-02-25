import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { canAccessAgent, requireSignedIn } from '@/lib/api-guard';
import { isValidAgentId, safeJoinWithin } from '@/lib/security';

const WORKSPACES_BASE = path.resolve(process.cwd(), '../../workspaces');

function appendNote(agentId: string, fileName: 'USER.md' | 'ACTIVE.md', line: string) {
  const p = safeJoinWithin(WORKSPACES_BASE, agentId, fileName);
  if (!p) throw new Error('Invalid path');
  const prev = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  fs.writeFileSync(p, `${prev.trimEnd()}\n- ${line}\n`, 'utf8');
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSignedIn();
    const body = await request.json() as { agentId?: string; instruction: string };

    const agentId = body.agentId || actor.agentId;
    if (!agentId || !isValidAgentId(agentId)) {
      return NextResponse.json({ error: 'Invalid agentId' }, { status: 400 });
    }
    if (!canAccessAgent(actor, agentId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const instruction = (body.instruction || '').trim();
    if (!instruction) {
      return NextResponse.json({ error: 'Instruction is required' }, { status: 400 });
    }

    const stamp = new Date().toISOString();
    appendNote(agentId, 'USER.md', `[${stamp}] Preference update: ${instruction}`);
    appendNote(agentId, 'ACTIVE.md', `[${stamp}] Personality tweak requested: ${instruction}`);

    return NextResponse.json({
      ok: true,
      message: 'Preference captured. Agent will use this in future turns.',
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to apply update' }, { status: 500 });
  }
}
