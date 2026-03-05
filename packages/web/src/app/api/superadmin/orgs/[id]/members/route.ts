import { NextRequest, NextResponse } from 'next/server';
import { requireActorOrgMembership, requireSuperadmin } from '@/lib/api-guard';
import { getDb } from '@/lib/admin-db-server';
import { upsertOrganizationMembership, writeAuditEvent } from '@/lib/admin-db';
import crypto from 'crypto';

function errorResponse(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json({ code, message, details, requestId: crypto.randomUUID() }, { status });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperadmin();
    const { id } = await params;
    requireActorOrgMembership(actor, id);
    const db = getDb();
    const rows = db.prepare(`
      SELECT m.organization_id, m.user_id, m.role, m.created_at, m.updated_at, u.email, u.name
      FROM organization_memberships m
      LEFT JOIN users u ON u.id = m.user_id
      WHERE m.organization_id = ?
      ORDER BY m.created_at DESC
    `).all(id);
    return NextResponse.json(rows);
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return errorResponse('unauthenticated', 'Not authenticated', 401);
    if (err instanceof Error && (err.message === 'FORBIDDEN' || err.message === 'FORBIDDEN_SUPERADMIN')) return errorResponse('insufficient_role', 'Forbidden', 403);
    if (err instanceof Error && err.message === 'FORBIDDEN_ORG_MEMBERSHIP') return errorResponse('forbidden_org_membership', 'Forbidden', 403, { reason: 'ORG_MEMBERSHIP_REQUIRED' });
    console.error('List org members error:', err);
    return errorResponse('internal_error', 'Failed to list organization members', 500);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperadmin();
    const { id } = await params;
    requireActorOrgMembership(actor, id);
    const body = await request.json();
    const userId = typeof body?.userId === 'string' ? body.userId : '';
    const role = body?.role === 'owner' || body?.role === 'admin' || body?.role === 'member' ? body.role : 'member';

    if (!userId) return errorResponse('validation_error', 'userId is required', 400);

    const membership = upsertOrganizationMembership({ organizationId: id, userId, role });

    writeAuditEvent({
      actorUserId: actor.userId,
      action: 'org.membership.upsert',
      entityType: 'organization_membership',
      entityId: `${id}:${userId}`,
      orgId: id,
      metadata: { role },
    });

    return NextResponse.json(membership, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return errorResponse('unauthenticated', 'Not authenticated', 401);
    if (err instanceof Error && (err.message === 'FORBIDDEN' || err.message === 'FORBIDDEN_SUPERADMIN')) return errorResponse('insufficient_role', 'Forbidden', 403);
    if (err instanceof Error && err.message === 'FORBIDDEN_ORG_MEMBERSHIP') return errorResponse('forbidden_org_membership', 'Forbidden', 403, { reason: 'ORG_MEMBERSHIP_REQUIRED' });
    console.error('Upsert org member error:', err);
    return errorResponse('internal_error', 'Failed to upsert organization member', 500);
  }
}
