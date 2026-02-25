import { NextRequest, NextResponse } from 'next/server';
import { verifyInstallToken, getMarketplaceSkill, packageSkill } from '@/lib/marketplace';
import fs from 'fs';
import path from 'path';
import { canAccessAgent, requireSignedIn } from '@/lib/api-guard';
import { isValidAgentId, safeJoinWithin } from '@/lib/security';

const WORKSPACES_BASE = path.resolve(process.cwd(), '../../workspaces');
const SKILLS_SOURCE = path.resolve(process.cwd(), '../../packages/engine/skills');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let body: { token?: string; agentId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const token = body.token;
    if (!token) {
      return NextResponse.json(
        { error: 'Missing install token. Get one from the marketplace UI.' },
        { status: 401 }
      );
    }

    const payload = verifyInstallToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired install token. Generate a new one from the marketplace.' },
        { status: 403 }
      );
    }

    if (payload.skillId !== id) {
      return NextResponse.json(
        { error: 'Token does not match the requested skill.' },
        { status: 403 }
      );
    }

    const skill = getMarketplaceSkill(id);
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    const agentId = payload.agentId;
    if (!agentId) {
      return NextResponse.json(
        { error: 'Missing agentId. Specify which agent to install the skill for.' },
        { status: 400 }
      );
    }
    if (body.agentId && body.agentId !== agentId) {
      return NextResponse.json({ error: 'agentId mismatch with token.' }, { status: 403 });
    }
    if (!isValidAgentId(agentId)) {
      return NextResponse.json({ error: 'Invalid agentId.' }, { status: 400 });
    }

    const actor = await requireSignedIn();
    if (!canAccessAgent(actor, agentId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sourceDir = path.join(SKILLS_SOURCE, id);
    if (!fs.existsSync(sourceDir)) {
      return NextResponse.json(
        { error: 'Skill source not available. This skill may be coming soon.' },
        { status: 404 }
      );
    }

    const destDir = safeJoinWithin(WORKSPACES_BASE, agentId, 'skills', id);
    if (!destDir) {
      return NextResponse.json({ error: 'Invalid install path.' }, { status: 400 });
    }

    fs.mkdirSync(destDir, { recursive: true });
    copyDirSync(sourceDir, destDir);

    return NextResponse.json({
      success: true,
      skill: {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        version: skill.version,
        connectionType: skill.connectionType,
      },
      installedTo: `workspaces/${agentId}/skills/${id}`,
      instructions: skill.connectionType
        ? `Skill installed. This skill requires a "${skill.connectionType}" connection. Ask your admin to set one up in the Admin Console → Connections.`
        : 'Skill installed successfully. You can start using it right away.',
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to install skill: ${errMsg}` },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Missing install token. Get one from the marketplace UI.' },
        { status: 401 }
      );
    }

    const payload = verifyInstallToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired install token. Generate a new one from the marketplace.' },
        { status: 403 }
      );
    }

    if (payload.skillId !== id) {
      return NextResponse.json(
        { error: 'Token does not match the requested skill.' },
        { status: 403 }
      );
    }

    if (!isValidAgentId(payload.agentId)) {
      return NextResponse.json({ error: 'Invalid agentId in token.' }, { status: 400 });
    }

    const actor = await requireSignedIn();
    if (!canAccessAgent(actor, payload.agentId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const skill = getMarketplaceSkill(id);
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    const pkg = packageSkill(id);
    if (!pkg) {
      return NextResponse.json(
        { error: 'Skill source not available. This skill may be coming soon.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      skill: {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        version: skill.version,
        connectionType: skill.connectionType,
      },
      package: pkg,
      instructions: skill.connectionType
        ? `Skill installed. This skill requires a "${skill.connectionType}" connection. Ask your admin to set one up in the Admin Console → Connections.`
        : 'Skill installed successfully. You can start using it right away.',
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to get skill package: ${errMsg}` }, { status: 500 });
  }
}

function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
