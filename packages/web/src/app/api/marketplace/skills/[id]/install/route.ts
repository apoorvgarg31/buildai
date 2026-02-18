import { NextRequest, NextResponse } from 'next/server';
import { verifyInstallToken, getMarketplaceSkill, packageSkill } from '@/lib/marketplace';
import fs from 'fs';
import path from 'path';

const WORKSPACES_BASE = path.resolve(process.cwd(), '../../workspaces');
const SKILLS_SOURCE = path.resolve(process.cwd(), '../../packages/engine/skills');

/**
 * POST /api/marketplace/skills/:id/install
 *
 * Server-side skill installation. Copies skill files directly from the engine
 * skills directory into the agent's workspace. No more curl from localhost.
 *
 * Body: { token: string, agentId?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  // Verify the token
  const payload = verifyInstallToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: 'Invalid or expired install token. Generate a new one from the marketplace.' },
      { status: 403 }
    );
  }

  // Ensure token matches the requested skill
  if (payload.skillId !== id) {
    return NextResponse.json(
      { error: 'Token does not match the requested skill.' },
      { status: 403 }
    );
  }

  // Get skill metadata
  const skill = getMarketplaceSkill(id);
  if (!skill) {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
  }

  // Resolve agent ID
  const agentId = body.agentId || payload.agentId;
  if (!agentId) {
    return NextResponse.json(
      { error: 'Missing agentId. Specify which agent to install the skill for.' },
      { status: 400 }
    );
  }

  // Source skill directory
  const sourceDir = path.join(SKILLS_SOURCE, id);
  if (!fs.existsSync(sourceDir)) {
    return NextResponse.json(
      { error: 'Skill source not available. This skill may be coming soon.' },
      { status: 404 }
    );
  }

  // Destination: agent workspace skills directory
  const destDir = path.join(WORKSPACES_BASE, agentId, 'skills', id);

  try {
    // Create destination directory
    fs.mkdirSync(destDir, { recursive: true });

    // Copy all skill files from source to destination
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
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to install skill: ${errMsg}` },
      { status: 500 }
    );
  }
}

/**
 * GET /api/marketplace/skills/:id/install?token=xxx
 *
 * Legacy endpoint: returns skill package as JSON for agents that prefer to
 * write files themselves. Kept for backward compatibility.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json(
      { error: 'Missing install token. Get one from the marketplace UI.' },
      { status: 401 }
    );
  }

  // Verify the token
  const payload = verifyInstallToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: 'Invalid or expired install token. Generate a new one from the marketplace.' },
      { status: 403 }
    );
  }

  // Ensure token matches the requested skill
  if (payload.skillId !== id) {
    return NextResponse.json(
      { error: 'Token does not match the requested skill.' },
      { status: 403 }
    );
  }

  // Get skill metadata
  const skill = getMarketplaceSkill(id);
  if (!skill) {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
  }

  // Package the skill files
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
}

/**
 * Recursively copy a directory.
 */
function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue; // Skip .env, .git, etc.
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
