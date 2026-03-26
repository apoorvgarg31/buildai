import { auth } from '@clerk/nextjs/server';
import { getDb } from './admin-db-server';

export type OrgRole = 'owner' | 'admin' | 'maintainer' | 'reviewer' | 'member' | 'auditor';
export type OrgPermission =
  | 'org.manage'
  | 'org.members.manage'
  | 'agent.manage'
  | 'files.delete'
  | 'artifacts.delete'
  | 'files.read'
  | 'artifacts.read';

export interface RequestActor {
  userId: string;
  role: 'admin' | 'user';
  agentId: string | null;
  email: string;
  isSuperadmin: boolean;
  orgId: string | null;
}

export function isConfiguredSuperadmin(userId: string, email: string): boolean {
  const raw = process.env.BUILDAI_SUPERADMINS || '';
  const entries = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (entries.length === 0) return false;
  return entries.includes(userId.toLowerCase()) || (email ? entries.includes(email.toLowerCase()) : false);
}

export async function getRequestActor(): Promise<RequestActor | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const db = getDb();
  const row = db.prepare(`
    SELECT id, role, agent_id, email, org_id
    FROM users
    WHERE id = ?
    LIMIT 1
  `).get(userId) as { id: string; role?: string; agent_id?: string | null; email?: string; org_id?: string | null } | undefined;

  if (!row) return null;

  const email = row.email || '';
  return {
    userId,
    role: row.role === 'admin' ? 'admin' : 'user',
    agentId: row.agent_id || null,
    email,
    isSuperadmin: isConfiguredSuperadmin(userId, email),
    orgId: row.org_id || null,
  };
}

export async function requireSignedIn(): Promise<RequestActor> {
  const actor = await getRequestActor();
  if (!actor) {
    throw new Error('UNAUTHENTICATED');
  }
  return actor;
}

export async function requireAdmin(): Promise<RequestActor> {
  const actor = await requireSignedIn();
  if (actor.role !== 'admin') {
    throw new Error('FORBIDDEN');
  }
  return actor;
}

export async function requireSuperadmin(): Promise<RequestActor> {
  const actor = await requireSignedIn();
  const configured = (process.env.BUILDAI_SUPERADMINS || '').trim().length > 0;
  if (!configured) {
    throw new Error('FORBIDDEN_SUPERADMIN_CONFIG');
  }
  if (!actor.isSuperadmin) {
    throw new Error('FORBIDDEN_SUPERADMIN');
  }
  return actor;
}

export function actorOrgIds(actor: RequestActor): string[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT organization_id FROM organization_memberships WHERE user_id = ? ORDER BY organization_id'
  ).all(actor.userId) as Array<{ organization_id: string }>;

  const orgIds = new Set(rows.map((r) => r.organization_id));
  if (actor.orgId) orgIds.add(actor.orgId);
  return Array.from(orgIds);
}

export function requireActorOrgMembership(actor: RequestActor, orgId: string): void {
  if (!orgId) throw new Error('ORG_REQUIRED');
  if (!actorOrgIds(actor).includes(orgId)) {
    throw new Error('FORBIDDEN_ORG_MEMBERSHIP');
  }
}

export function getActorRoleInOrg(actor: RequestActor, orgId: string): OrgRole | null {
  if (!orgId) return null;
  const db = getDb();
  const row = db.prepare(
    'SELECT role FROM organization_memberships WHERE organization_id = ? AND user_id = ? LIMIT 1'
  ).get(orgId, actor.userId) as { role?: string } | undefined;
  const role = row?.role;
  if (!role) return null;

  if (role === 'owner' || role === 'admin' || role === 'maintainer' || role === 'reviewer' || role === 'member' || role === 'auditor') {
    return role;
  }
  return 'member';
}

const PERMISSION_MATRIX: Record<OrgRole, OrgPermission[]> = {
  owner: ['org.manage', 'org.members.manage', 'agent.manage', 'files.delete', 'artifacts.delete', 'files.read', 'artifacts.read'],
  admin: ['org.manage', 'org.members.manage', 'agent.manage', 'files.delete', 'artifacts.delete', 'files.read', 'artifacts.read'],
  maintainer: ['agent.manage', 'files.delete', 'artifacts.delete', 'files.read', 'artifacts.read'],
  reviewer: ['files.read', 'artifacts.read'],
  member: ['files.read', 'artifacts.read'],
  auditor: ['files.read', 'artifacts.read'],
};

export function hasOrgPermission(role: OrgRole | null, permission: OrgPermission): boolean {
  if (!role) return false;
  return PERMISSION_MATRIX[role].includes(permission);
}

export function requireOrgPermission(actor: RequestActor, orgId: string, permission: OrgPermission): void {
  requireActorOrgMembership(actor, orgId);
  const role = getActorRoleInOrg(actor, orgId);
  if (!hasOrgPermission(role, permission)) {
    throw new Error('FORBIDDEN_ORG_ROLE');
  }
}

export function getAgentOrgId(agentId: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT org_id FROM agents WHERE id = ? LIMIT 1').get(agentId) as { org_id?: string | null } | undefined;
  return row?.org_id || null;
}

export function userHasAssignedConnection(userId: string, connectionId: string): boolean {
  const db = getDb();
  const row = db.prepare(`
    SELECT 1
    FROM users u
    JOIN agent_connections ac ON ac.agent_id = u.agent_id
    WHERE u.id = ? AND ac.connection_id = ?
    LIMIT 1
  `).get(userId, connectionId);
  return !!row;
}

export function canAccessAgent(actor: RequestActor, agentId: string): boolean {
  const agentOrgId = getAgentOrgId(agentId);
  if (!agentOrgId) {
    return actor.role === 'admin' || actor.agentId === agentId;
  }

  const sameOrg = actorOrgIds(actor).includes(agentOrgId);
  if (!sameOrg) return false;

  return actor.role === 'admin' || actor.agentId === agentId;
}

export function assertCanAccessAgent(actor: RequestActor, agentId: string): void {
  if (!canAccessAgent(actor, agentId)) {
    throw new Error('FORBIDDEN_ORG_MISMATCH');
  }
}

export function assertCanManageAgent(actor: RequestActor, agentId: string): void {
  const agentOrgId = getAgentOrgId(agentId);
  if (!agentOrgId) {
    if (actor.role !== 'admin') throw new Error('FORBIDDEN');
    return;
  }
  if (!actorOrgIds(actor).includes(agentOrgId)) {
    throw new Error('FORBIDDEN_ORG_MISMATCH');
  }
  if (actor.role === 'admin' && actor.isSuperadmin) return;
  requireOrgPermission(actor, agentOrgId, 'agent.manage');
}
