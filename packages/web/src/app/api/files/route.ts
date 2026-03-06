import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { canAccessAgent, requireSignedIn } from '@/lib/api-guard';
import { getAgentOrgId } from '@/lib/api-guard';
import { isValidAgentId, safeJoinWithin } from '@/lib/security';
import { apiError } from '@/lib/api-error';
import { writeAuditEvent } from '@/lib/admin-db';

function getWorkspaceBase(): string {
  return path.resolve(process.cwd(), '../../workspaces');
}

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.csv': 'text/csv', '.txt': 'text/plain', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
};

function getMimeType(ext: string): string { return MIME_MAP[ext.toLowerCase()] || 'application/octet-stream'; }

export async function GET(request: NextRequest) {
  try {
    const actor = await requireSignedIn();
    const agentId = request.nextUrl.searchParams.get('agentId');

    if (!agentId) return apiError('validation_error', 'agentId is required', 400);
    if (!isValidAgentId(agentId)) return apiError('validation_error', 'Invalid agentId', 400);
    if (!canAccessAgent(actor, agentId)) {
      writeAuditEvent({ actorUserId: actor.userId, action: 'files.list.denied', entityType: 'file', entityId: agentId, orgId: getAgentOrgId(agentId) || undefined, metadata: { reason: 'ORG_MISMATCH' } });
      return apiError('forbidden_org_membership', 'Forbidden', 403, { reason: 'ORG_MISMATCH' });
    }

    const filesDir = safeJoinWithin(getWorkspaceBase(), agentId, 'files');
    if (!filesDir) return apiError('validation_error', 'Invalid path', 400);
    if (!fs.existsSync(filesDir)) return NextResponse.json([]);

    const entries = fs.readdirSync(filesDir);
    const files = entries.filter((name) => !name.endsWith('.extracted.json')).map((name) => {
      const filePath = path.join(filesDir, name);
      const stat = fs.statSync(filePath);
      const ext = path.extname(name).toLowerCase();
      const extractionPath = filePath.replace(/(\.[^.]+)$/, '.extracted.json');
      return { id: name, name, size: stat.size, type: getMimeType(ext), uploadedAt: stat.mtime.toISOString(), hasExtraction: fs.existsSync(extractionPath) };
    }).sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    return NextResponse.json(files);
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    console.error('File list error:', err);
    return apiError('internal_error', 'Failed to list files', 500);
  }
}
