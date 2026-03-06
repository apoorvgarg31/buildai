import { NextRequest, NextResponse } from 'next/server';
import { deleteOrganization, getOrganization, updateOrganization, writeAuditEvent } from '@/lib/admin-db';
import { requireSuperadmin } from '@/lib/api-guard';
import { apiError } from '@/lib/api-error';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperadmin();
    const { id } = await params;
    const org = getOrganization(id);
    if (!org) return apiError('not_found', 'Organization not found', 404);
    return NextResponse.json(org);
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    if (err instanceof Error && (err.message === 'FORBIDDEN' || err.message === 'FORBIDDEN_SUPERADMIN')) return apiError('insufficient_role', 'Forbidden', 403);
    return apiError('internal_error', 'Failed to fetch organization', 500);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperadmin();
    const { id } = await params;
    const body = await request.json();
    const org = updateOrganization(id, { name: body?.name, slug: body?.slug });
    if (!org) return apiError('not_found', 'Organization not found', 404);

    writeAuditEvent({
      actorUserId: actor.userId,
      action: 'org.update',
      entityType: 'organization',
      entityId: org.id,
      orgId: org.id,
      metadata: { name: org.name, slug: org.slug },
    });

    return NextResponse.json(org);
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    if (err instanceof Error && (err.message === 'FORBIDDEN' || err.message === 'FORBIDDEN_SUPERADMIN')) return apiError('insufficient_role', 'Forbidden', 403);
    if (err instanceof Error && (err.message === 'INVALID_ORG_NAME' || err.message === 'INVALID_ORG_SLUG')) return apiError('validation_error', 'Invalid organization name or slug', 400);
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed: organizations.slug')) return apiError('conflict', 'Organization slug already exists', 409);
    return apiError('internal_error', 'Failed to update organization', 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperadmin();
    const { id } = await params;
    const ok = deleteOrganization(id);
    if (!ok) return apiError('not_found', 'Organization not found', 404);

    writeAuditEvent({
      actorUserId: actor.userId,
      action: 'org.delete',
      entityType: 'organization',
      entityId: id,
      orgId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    if (err instanceof Error && (err.message === 'FORBIDDEN' || err.message === 'FORBIDDEN_SUPERADMIN')) return apiError('insufficient_role', 'Forbidden', 403);
    return apiError('internal_error', 'Failed to delete organization', 500);
  }
}
