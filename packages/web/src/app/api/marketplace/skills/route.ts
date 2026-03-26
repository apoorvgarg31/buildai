import { NextRequest, NextResponse } from 'next/server';
import { getCategories, listMarketplaceSkills } from '@/lib/marketplace';
import { canAccessAgent, requireSignedIn } from '@/lib/api-guard';
import { listUserSkillInstalls } from '@/lib/admin-db';
import { apiError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const actor = await requireSignedIn();
    const agentId = request.nextUrl.searchParams.get('agentId') || actor.agentId || undefined;

    if (agentId) {
      if (!canAccessAgent(actor, agentId)) return apiError('forbidden_agent_access', 'Forbidden', 403, { reason: 'AGENT_ACCESS_DENIED' });
    }

    const userInstalls = listUserSkillInstalls(actor.userId);
    const userSet = new Set(userInstalls.map((u) => u.skill_id));

    const skills = listMarketplaceSkills().map((s) => {
      const installedByUser = userSet.has(s.id);
      return {
        ...s,
        installedByUser,
        effectiveSource: installedByUser ? 'user_installed_public' : 'public',
        removableByUser: installedByUser,
        installablePublic: !installedByUser,
      };
    });

    const categories = getCategories();
    return NextResponse.json({ skills, categories });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    console.error('Marketplace list error:', err);
    return apiError('internal_error', 'Failed to list skills', 500);
  }
}
