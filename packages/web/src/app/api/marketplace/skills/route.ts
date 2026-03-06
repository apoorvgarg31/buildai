import { NextRequest, NextResponse } from 'next/server';
import { getCategories, listMarketplaceSkills } from '@/lib/marketplace';
import { actorOrgIds, canAccessAgent, requireSignedIn } from '@/lib/api-guard';
import { getAgent } from '@/lib/admin-db';
import { listOrgSkillAssignments, listUserSkillInstalls } from '@/lib/admin-db';
import { apiError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const actor = await requireSignedIn();
    const agentId = request.nextUrl.searchParams.get('agentId') || actor.agentId || undefined;

    let activeOrgId: string | null = actor.orgId || null;
    if (agentId) {
      if (!canAccessAgent(actor, agentId)) return apiError('forbidden_org_membership', 'Forbidden', 403, { reason: 'ORG_MISMATCH' });
      const agent = getAgent(agentId);
      activeOrgId = agent?.org_id || activeOrgId;
    }

    if (!activeOrgId) {
      const orgs = actorOrgIds(actor);
      activeOrgId = orgs[0] || null;
    }

    const orgAssignments = activeOrgId ? listOrgSkillAssignments(activeOrgId) : [];
    const orgMap = new Map(orgAssignments.map((a) => [a.skill_id, a]));
    const userInstalls = listUserSkillInstalls(actor.userId, activeOrgId || null);
    const userSet = new Set(userInstalls.map((u) => u.skill_id));

    const skills = listMarketplaceSkills().map((s) => {
      const orgAssignment = orgMap.get(s.id);
      const installedByUser = userSet.has(s.id);
      const assignedByOrg = !!orgAssignment;
      const requiredByOrg = !!orgAssignment && orgAssignment.required === 1;
      const effectiveSource = assignedByOrg ? 'org_assigned' : installedByUser ? 'user_installed_public' : 'public';
      const removableByUser = installedByUser && !requiredByOrg;
      const installablePublic = !assignedByOrg;
      return {
        ...s,
        assignedByOrg,
        requiredByOrg,
        installedByUser,
        effectiveSource,
        removableByUser,
        installablePublic,
      };
    });

    const categories = getCategories();
    return NextResponse.json({ skills, categories, activeOrgId });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    console.error('Marketplace list error:', err);
    return apiError('internal_error', 'Failed to list skills', 500);
  }
}
