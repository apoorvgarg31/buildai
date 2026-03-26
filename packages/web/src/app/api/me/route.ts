import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';

function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

type MeRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  agent_id: string | null;
};

async function getUserProfile(userId: string): Promise<MeRow | null> {
  const { getDb } = await import('@/lib/admin-db-server');
  const db = getDb();
  const row = db.prepare(
    'SELECT id, email, name, role, agent_id FROM users WHERE id = ?'
  ).get(userId) as MeRow | undefined;
  return row || null;
}

async function readMeState(userId: string) {
  const row = await getUserProfile(userId);
  if (row) {
    const { getDb } = await import('@/lib/admin-db-server');
    const db = getDb();
    const assigned = row.agent_id
      ? db.prepare('SELECT id, status FROM agents WHERE id = ?').get(row.agent_id) as { id: string; status?: string | null } | undefined
      : undefined;
    const hasActiveAgent = !!assigned && (!assigned.status || assigned.status === 'active');

    return {
      userId: row.id,
      email: row.email,
      name: row.name,
      role: row.role === 'admin' ? 'admin' : 'user',
      agentId: hasActiveAgent ? row.agent_id : null,
      needsProvisioning: !hasActiveAgent,
    };
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress || '';
  const name = clerkUser?.fullName || clerkUser?.firstName || 'User';

  return {
    userId,
    email,
    name,
    role: 'user' as const,
    agentId: null,
    needsProvisioning: true,
  };
}

async function provisionMe(userId: string) {
  const { getDb } = await import('@/lib/admin-db-server');
  const { createAgent } = await import('@/lib/admin-db');
  const { provisionWorkspace, workspaceExists } = await import('@/lib/workspace-provisioner');
  const { addAgentToConfig } = await import('@/lib/engine-config');

  const db = getDb();
  let row = await getUserProfile(userId);
  if (!row) {
    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses?.[0]?.emailAddress || '';
    const name = clerkUser?.fullName || clerkUser?.firstName || 'User';
    const existingUsers = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count?: number } | undefined;
    const role = (existingUsers?.count || 0) === 0 ? 'admin' : 'user';
    db.prepare('INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)').run(userId, email, name, role);
    row = await getUserProfile(userId);
  }
  if (!row) throw new Error('USER_CREATE_FAILED');

  let selectedAgentId = row.agent_id;
  const assigned = row.agent_id
    ? db.prepare('SELECT id, status FROM agents WHERE id = ?').get(row.agent_id) as { id: string; status?: string | null } | undefined
    : undefined;

  if (!assigned || (assigned.status && assigned.status !== 'active')) {
    selectedAgentId = null;

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
          id: agentIdBase,
          name: agentDisplayName,
          userId,
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
  }

  return readMeState(userId);
}

/**
 * GET /api/me — returns current user role + assignment without provisioning side effects.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    return NextResponse.json(await readMeState(userId));
  } catch (err) {
    console.error('GET /api/me error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * POST /api/me — idempotently provisions the current user's agent.
 */
export async function POST(_request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    return NextResponse.json(await provisionMe(userId));
  } catch (err) {
    console.error('POST /api/me error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
