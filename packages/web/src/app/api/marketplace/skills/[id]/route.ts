import { NextRequest, NextResponse } from 'next/server';
import { getMarketplaceSkill, generateInstallToken } from '@/lib/marketplace';

/**
 * GET /api/marketplace/skills/:id
 * Returns skill details + readme.
 * If ?agentId= is provided, also generates an install token.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const skill = getMarketplaceSkill(id);

  if (!skill) {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
  }

  const agentId = request.nextUrl.searchParams.get('agentId');
  let installUrl: string | undefined;
  let installToken: string | undefined;

  if (agentId) {
    installToken = generateInstallToken(id, agentId);
    const base = request.nextUrl.origin;
    installUrl = `${base}/api/marketplace/skills/${id}/install?token=${installToken}`;
  }

  return NextResponse.json({
    ...skill,
    installUrl,
    installToken,
  });
}
