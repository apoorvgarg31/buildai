import { execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';
import { NextRequest, NextResponse } from 'next/server';
import { canAccessAgent, requireSignedIn } from '@/lib/api-guard';
import { isValidAgentId } from '@/lib/security';

const execFileAsync = promisify(execFile);

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSignedIn();
    const body = await request.json() as {
      agentId?: string;
      role?: string;
      systems?: string[];
      painPoints?: string[];
    };

    const agentId = body.agentId || actor.agentId;
    if (!agentId || !isValidAgentId(agentId)) {
      return NextResponse.json({ error: 'Invalid agentId' }, { status: 400 });
    }
    if (!canAccessAgent(actor, agentId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const role = (body.role || '').trim();
    const systems = (body.systems || []).map((s) => String(s).trim()).filter(Boolean);
    const pains = (body.painPoints || []).map((p) => String(p).trim()).filter(Boolean);

    const script = path.resolve(process.cwd(), '../../engine/skills/buildai-skill-discovery/recommend.py');

    const args = [
      script,
      '--role', role,
      '--systems', systems.join(','),
      ...pains.flatMap((p) => ['--pain', p]),
    ];

    const { stdout } = await execFileAsync('python3', args, { timeout: 10000 });
    const parsed = JSON.parse(stdout);

    return NextResponse.json(parsed);
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to get recommendations: ${msg}` }, { status: 500 });
  }
}
