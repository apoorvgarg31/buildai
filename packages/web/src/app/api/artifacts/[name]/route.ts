import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { canAccessAgent, requireSignedIn } from '@/lib/api-guard';
import { isValidAgentId, safeJoinWithin } from '@/lib/security';
import { apiError } from '@/lib/api-error';
import { writeAuditEvent } from '@/lib/admin-db';

function getWorkspaceBase(): string { return path.resolve(process.cwd(), '../../workspaces'); }

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.csv': 'text/csv', '.txt': 'text/plain', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.zip': 'application/zip',
};
function getMimeType(ext: string): string { return MIME_MAP[ext.toLowerCase()] || 'application/octet-stream'; }

function validateAccess(agentId: string | null, actor: Awaited<ReturnType<typeof requireSignedIn>>, entityId: string) {
  if (!agentId) return apiError('validation_error', 'agentId is required', 400);
  if (!isValidAgentId(agentId)) return apiError('validation_error', 'Invalid agentId', 400);
  if (!canAccessAgent(actor, agentId)) {
    writeAuditEvent({ actorUserId: actor.userId, action: 'artifact.access.denied', entityType: 'artifact', entityId, metadata: { reason: 'AGENT_ACCESS_DENIED' } });
    return apiError('forbidden_agent_access', 'Forbidden', 403, { reason: 'AGENT_ACCESS_DENIED' });
  }
  return null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const actor = await requireSignedIn();
    const { name } = await params;
    const agentId = request.nextUrl.searchParams.get('agentId');

    const denied = validateAccess(agentId, actor, `${agentId || 'unknown'}:${name}`);
    if (denied) return denied;
    const checkedAgentId = agentId as string;

    if (!name) return apiError('validation_error', 'File name is required', 400);

    const artifactsDir = safeJoinWithin(getWorkspaceBase(), checkedAgentId, 'artifacts');
    if (!artifactsDir) return apiError('validation_error', 'Invalid path', 400);
    const filePath = safeJoinWithin(artifactsDir, name);
    if (!filePath) return apiError('validation_error', 'Invalid file path', 400);
    if (!fs.existsSync(filePath)) return apiError('not_found', 'File not found', 404);

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return apiError('validation_error', 'Not a file', 400);

    const ext = path.extname(name).toLowerCase();
    const mimeType = getMimeType(ext);
    const buffer = fs.readFileSync(filePath);

    return new NextResponse(buffer, { status: 200, headers: { 'Content-Type': mimeType, 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    console.error('Artifacts download error:', err);
    return apiError('internal_error', 'Failed to download artifact', 500);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const actor = await requireSignedIn();
    const { name } = await params;
    const agentId = request.nextUrl.searchParams.get('agentId');

    const denied = validateAccess(agentId, actor, `${agentId || 'unknown'}:${name}`);
    if (denied) return denied;
    const checkedAgentId = agentId as string;

    if (!name) return apiError('validation_error', 'File name is required', 400);

    const artifactsDir = safeJoinWithin(getWorkspaceBase(), checkedAgentId, 'artifacts');
    if (!artifactsDir) return apiError('validation_error', 'Invalid path', 400);
    const filePath = safeJoinWithin(artifactsDir, name);
    if (!filePath) return apiError('validation_error', 'Invalid file path', 400);
    if (!fs.existsSync(filePath)) return apiError('not_found', 'File not found', 404);

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return apiError('validation_error', 'Not a file', 400);

    fs.unlinkSync(filePath);
    return NextResponse.json({ success: true, name });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    console.error('Artifacts delete error:', err);
    return apiError('internal_error', 'Failed to delete artifact', 500);
  }
}
