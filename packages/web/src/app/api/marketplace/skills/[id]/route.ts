import { NextRequest, NextResponse } from 'next/server';
import { getMarketplaceSkill, generateInstallToken } from '@/lib/marketplace';
import { canAccessAgent, getAgentOrgId, requireSignedIn } from '@/lib/api-guard';
import { isValidAgentId, safeJoinWithin } from '@/lib/security';
import { deleteUserSkillInstall, listOrgSkillAssignments } from '@/lib/admin-db';
import { apiError } from '@/lib/api-error';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/marketplace/skills/:id
 * Returns skill details + readme.
 * If ?agentId= is provided, also generates an install token.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const skill = getMarketplaceSkill(id);

    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    const agentId = request.nextUrl.searchParams.get('agentId');
    let installUrl: string | undefined;
    let installToken: string | undefined;

    if (agentId) {
      if (!isValidAgentId(agentId)) {
        return NextResponse.json({ error: 'Invalid agentId' }, { status: 400 });
      }
      const actor = await requireSignedIn();
      if (!canAccessAgent(actor, agentId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      installToken = generateInstallToken(id, agentId);
      const base = request.nextUrl.origin;
      installUrl = `${base}/api/marketplace/skills/${id}/install?token=${installToken}`;
    }

    return NextResponse.json({
      ...skill,
      installUrl,
      installToken,
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return apiError('unauthenticated', 'Not authenticated', 401);
    }
    console.error('Marketplace skill detail error:', err);
    return apiError('internal_error', 'Failed to get skill details', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const actor = await requireSignedIn();
    const agentId = request.nextUrl.searchParams.get('agentId') || actor.agentId;
    if (!agentId) return apiError('validation_error', 'agentId is required', 400);
    if (!isValidAgentId(agentId)) return apiError('validation_error', 'Invalid agentId', 400);
    if (!canAccessAgent(actor, agentId)) return apiError('forbidden_org_membership', 'Forbidden', 403, { reason: 'ORG_MISMATCH' });

    const orgId = getAgentOrgId(agentId);
    if (orgId) {
      const orgRequired = listOrgSkillAssignments(orgId).find((s) => s.skill_id === id && s.required === 1);
      if (orgRequired) {
        return apiError('policy_blocked', 'Cannot remove required org-assigned skill', 403, { reason: 'REQUIRED_ORG_SKILL' });
      }
    }

    const removed = deleteUserSkillInstall(actor.userId, orgId, id);

    const skillsDir = safeJoinWithin(path.resolve(process.cwd(), '../../workspaces'), agentId, 'skills', id);
    if (skillsDir && fs.existsSync(skillsDir)) {
      fs.rmSync(skillsDir, { recursive: true, force: true });
    }

    return NextResponse.json({ ok: removed || true });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    return apiError('internal_error', 'Failed to remove skill', 500);
  }
}
