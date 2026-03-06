import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { canAccessAgent, getAgentOrgId, requireSignedIn } from '@/lib/api-guard';
import { isValidAgentId, safeJoinWithin } from '@/lib/security';
import { apiError } from '@/lib/api-error';
import { writeAuditEvent } from '@/lib/admin-db';

function getWorkspaceBase(): string { return path.resolve(process.cwd(), '../../workspaces'); }

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.csv': 'text/csv', '.txt': 'text/plain', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.zip': 'application/zip',
};

function getMimeType(ext: string): string { return MIME_MAP[ext.toLowerCase()] || 'application/octet-stream'; }

export async function GET(request: NextRequest) {
  try {
    const actor = await requireSignedIn();
    const agentId = request.nextUrl.searchParams.get('agentId');

    if (!agentId) return apiError('validation_error', 'agentId is required', 400);
    if (!isValidAgentId(agentId)) return apiError('validation_error', 'Invalid agentId', 400);
    if (!canAccessAgent(actor, agentId)) {
      writeAuditEvent({ actorUserId: actor.userId, action: 'artifacts.list.denied', entityType: 'artifact', entityId: agentId, orgId: getAgentOrgId(agentId) || undefined, metadata: { reason: 'ORG_MISMATCH' } });
      return apiError('forbidden_org_membership', 'Forbidden', 403, { reason: 'ORG_MISMATCH' });
    }

    const artifactsDir = safeJoinWithin(getWorkspaceBase(), agentId, 'artifacts');
    if (!artifactsDir) return apiError('validation_error', 'Invalid path', 400);
    if (!fs.existsSync(artifactsDir)) return NextResponse.json([]);

    const entries = fs.readdirSync(artifactsDir);
    const files = entries.map((name) => {
      const filePath = path.join(artifactsDir, name);
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) return null;
      const ext = path.extname(name).toLowerCase();
      return { id: name, name, size: stat.size, type: getMimeType(ext), createdAt: stat.mtime.toISOString() };
    }).filter(Boolean).sort((a, b) => new Date((b as { createdAt: string }).createdAt).getTime() - new Date((a as { createdAt: string }).createdAt).getTime());

    return NextResponse.json(files);
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    console.error('Artifacts list error:', err);
    return apiError('internal_error', 'Failed to list artifacts', 500);
  }
}
