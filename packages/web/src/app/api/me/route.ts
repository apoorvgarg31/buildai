import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isConfiguredSuperadmin } from '@/lib/api-guard';

function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * GET /api/me — returns current user role + assignment.
 * Personal Google sign-in flow auto-provisions:
 * - user row (platform role=user)
 * - personal org + membership (member)
 * - default agent assigned to the user
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { getDb } = await import('@/lib/admin-db-server');
    const { createOrganization, upsertOrganizationMembership, createAgent } = await import('@/lib/admin-db');
    const { provisionWorkspace, workspaceExists } = await import('@/lib/workspace-provisioner');
    const { addAgentToConfig } = await import('@/lib/engine-config');

    const db = getDb();

    let row = db.prepare(
      'SELECT id, email, name, role, agent_id, org_id FROM users WHERE id = ?'
    ).get(userId) as { id: string; email: string; name: string; role: string; agent_id: string | null; org_id: string | null } | undefined;

    if (!row) {
      const clerkUser = await currentUser();
      const email = clerkUser?.emailAddresses?.[0]?.emailAddress || '';
      const name = clerkUser?.fullName || clerkUser?.firstName || 'User';

      // Personal login should always start in user mode.
      db.prepare('INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)').run(userId, email, name, 'user');

      row = db.prepare(
        'SELECT id, email, name, role, agent_id, org_id FROM users WHERE id = ?'
      ).get(userId) as { id: string; email: string; name: string; role: string; agent_id: string | null; org_id: string | null };
    }

    // 1) Ensure user has an org (personal auto-provision)
    if (!row.org_id) {
      const base = normalizeSlug(row.name || row.email || userId) || `user-${userId.slice(-6)}`;
      const orgName = `${row.name || 'Personal'} Workspace`;
      const org = createOrganization({
        name: orgName,
        slug: `${base}-${userId.slice(-6)}`,
        createdByUserId: userId,
      });

      db.prepare("UPDATE users SET org_id = ?, updated_at = datetime('now') WHERE id = ?").run(org.id, userId);
      upsertOrganizationMembership({ organizationId: org.id, userId, role: 'member' });

      row = db.prepare(
        'SELECT id, email, name, role, agent_id, org_id FROM users WHERE id = ?'
      ).get(userId) as { id: string; email: string; name: string; role: string; agent_id: string | null; org_id: string | null };
    }

    // 2) Ensure user has a valid assigned agent.
    let needsAgent = !row.agent_id;
    if (row.agent_id) {
      const assigned = db.prepare('SELECT id, api_key, status FROM agents WHERE id = ?').get(row.agent_id) as
        | { id: string; api_key: string | null; status: string }
        | undefined;
      if (!assigned || assigned.status !== 'active') needsAgent = true;
    }

    if (needsAgent) {
      // Prefer reusing existing org-scoped active agent first.
      const existingOrgAgent = db.prepare(
        "SELECT id FROM agents WHERE org_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1"
      ).get(row.org_id) as { id: string } | undefined;

      let selectedAgentId = existingOrgAgent?.id;

      if (!selectedAgentId) {
        const model = process.env.BUILDAI_DEFAULT_MODEL || 'google/gemini-2.0-flash';
        const envApiKey =
          process.env.GEMINI_API_KEY ||
          process.env.GOOGLE_API_KEY ||
          process.env.BUILDAI_LLM_API_KEY ||
          '';

        const agentIdBase = normalizeSlug(`${row.name || 'user'}-assistant-${userId.slice(-6)}`) || `agent-${userId.slice(-6)}`;
        const agentDisplayName = `${row.name || 'Personal'} Assistant`;

        const workspaceDir = workspaceExists(agentIdBase)
          ? `../../workspaces/${agentIdBase}`
          : await provisionWorkspace(agentIdBase);

        await addAgentToConfig(agentIdBase, {
          name: agentDisplayName,
          workspace: workspaceDir,
          model,
          apiKey: envApiKey || undefined,
        });

        const existingDbAgent = db.prepare('SELECT id FROM agents WHERE id = ?').get(agentIdBase) as { id: string } | undefined;
        if (!existingDbAgent) {
          createAgent({
            name: agentDisplayName,
            userId,
            orgId: row.org_id,
            model,
            apiKey: envApiKey || undefined,
            workspaceDir,
          });
        }

        selectedAgentId = agentIdBase;
      }

      if (selectedAgentId) {
        db.prepare("UPDATE users SET agent_id = ?, updated_at = datetime('now') WHERE id = ?").run(selectedAgentId, userId);
      }

      row = db.prepare(
        'SELECT id, email, name, role, agent_id, org_id FROM users WHERE id = ?'
      ).get(userId) as { id: string; email: string; name: string; role: string; agent_id: string | null; org_id: string | null };
    }

    return NextResponse.json({
      userId: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      isSuperadmin: isConfiguredSuperadmin(row.id, row.email || ''),
      agentId: row.agent_id || null,
      orgId: row.org_id || null,
    });
  } catch (err) {
    console.error('GET /api/me error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
