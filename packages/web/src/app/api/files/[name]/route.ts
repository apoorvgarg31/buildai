import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { canAccessAgent, getAgentOrgId, requireSignedIn } from '@/lib/api-guard';
import { isValidAgentId, safeJoinWithin } from '@/lib/security';
import { apiError } from '@/lib/api-error';
import { writeAuditEvent } from '@/lib/admin-db';

function getWorkspaceBase(): string { return path.resolve(process.cwd(), '../../workspaces'); }

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const actor = await requireSignedIn();
    const { name } = await params;
    const agentId = request.nextUrl.searchParams.get('agentId');

    if (!agentId) return apiError('validation_error', 'agentId is required', 400);
    if (!isValidAgentId(agentId)) return apiError('validation_error', 'Invalid agentId', 400);
    if (!canAccessAgent(actor, agentId)) {
      writeAuditEvent({ actorUserId: actor.userId, action: 'file.delete.denied', entityType: 'file', entityId: `${agentId}:${name}`, orgId: getAgentOrgId(agentId) || undefined, metadata: { reason: 'ORG_MISMATCH' } });
      return apiError('forbidden_org_membership', 'Forbidden', 403, { reason: 'ORG_MISMATCH' });
    }

    if (!name) return apiError('validation_error', 'File name is required', 400);

    const filesDir = safeJoinWithin(getWorkspaceBase(), agentId, 'files');
    if (!filesDir) return apiError('validation_error', 'Invalid file path', 400);
    const filePath = safeJoinWithin(filesDir, name);
    if (!filePath) return apiError('validation_error', 'Invalid file path', 400);
    if (!fs.existsSync(filePath)) return apiError('not_found', 'File not found', 404);

    fs.unlinkSync(filePath);

    const ext = path.extname(name);
    const baseName = path.basename(name, ext);
    const extractionPath = path.join(filesDir, `${baseName}.extracted.json`);
    if (fs.existsSync(extractionPath)) fs.unlinkSync(extractionPath);

    return NextResponse.json({ success: true, name });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    console.error('Delete error:', err);
    return apiError('internal_error', 'Failed to delete file', 500);
  }
}
