import { NextRequest, NextResponse } from 'next/server';
import { getMarketplaceSkill, generateInstallToken } from '@/lib/marketplace';
import { canAccessAgent, requireSignedIn } from '@/lib/api-guard';
import { isValidAgentId } from '@/lib/security';

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
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Marketplace skill detail error:', err);
    return NextResponse.json({ error: 'Failed to get skill details' }, { status: 500 });
  }
}
