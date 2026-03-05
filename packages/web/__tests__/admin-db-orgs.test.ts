import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

describe('admin-db org scaffolding (OA-1/OA-2)', () => {
  const originalCwd = process.cwd();
  let sandboxCwd: string;

  beforeEach(async () => {
    process.env.BUILDAI_ENCRYPTION_KEY = 'test-encryption-key';
    sandboxCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'buildai-org-db-'));
    const targetCwd = path.join(sandboxCwd, 'packages', 'web');
    fs.mkdirSync(targetCwd, { recursive: true });
    process.chdir(targetCwd);
    vi.resetModules();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(sandboxCwd, { recursive: true, force: true });
  });

  // AC-OA1-01: OA-1 scaffolding must not regress legacy user CRUD behavior.
  it('AC-OA1-01 preserves existing user CRUD behavior while org tables exist', async () => {
    const db = await import('../src/lib/admin-db');

    const user = db.createUser({ email: 'legacy@example.com', name: 'Legacy User' });
    const users = db.listUsers();

    expect(user.role).toBe('user');
    expect(users.some((u) => u.email === 'legacy@example.com')).toBe(true);
    expect(db.listOrganizations()).toEqual([]);
  });

  // AC-OA2-07: Organization create supports deterministic slug generation + explicit override.
  it('AC-OA2-07 creates organizations with slug fallback and explicit slug override', async () => {
    const db = await import('../src/lib/admin-db');

    const byName = db.createOrganization({ name: 'Acme Holdings LLC' });
    const byExplicitSlug = db.createOrganization({ name: 'Beta Org', slug: 'beta-custom' });

    expect(byName.slug).toBe('acme-holdings-llc');
    expect(byExplicitSlug.slug).toBe('beta-custom');

    const all = db.listOrganizations();
    expect(all).toHaveLength(2);
    expect(all.map((o) => o.slug)).toEqual(expect.arrayContaining(['acme-holdings-llc', 'beta-custom']));
  });

  // AC-OA2-08: Membership upsert is idempotent on (organization_id,user_id) and updates role.
  // AC-OA2-08: Membership upsert is idempotent on (organization_id,user_id) and updates role.
  it('AC-OA2-08 upserts organization memberships (insert then role update)', async () => {
    const db = await import('../src/lib/admin-db');

    const user = db.createUser({ email: 'owner@example.com', name: 'Owner User' });
    const org = db.createOrganization({ name: 'Gamma Org', createdByUserId: user.id });

    const created = db.upsertOrganizationMembership({
      organizationId: org.id,
      userId: user.id,
      role: 'owner',
    });

    const updated = db.upsertOrganizationMembership({
      organizationId: org.id,
      userId: user.id,
      role: 'admin',
    });

    expect(created.role).toBe('owner');
    expect(updated.role).toBe('admin');

    // Backward-compatible behavior: still a single membership row for same PK.
    const rows = (await import('../src/lib/admin-db-server')).getDb()
      .prepare('SELECT COUNT(*) as cnt FROM organization_memberships WHERE organization_id = ? AND user_id = ?')
      .get(org.id, user.id) as { cnt: number };
    expect(rows.cnt).toBe(1);
  });

  // AC-OA2-09 / P5-US-03: Cross-org membership isolation (same user can belong to multiple orgs independently).
  it('AC-OA2-09 enforces cross-org membership isolation by composite PK scope', async () => {
    const db = await import('../src/lib/admin-db');

    const user = db.createUser({ email: 'multi-org@example.com', name: 'Multi Org User' });
    const orgA = db.createOrganization({ name: 'Org A' });
    const orgB = db.createOrganization({ name: 'Org B' });

    db.upsertOrganizationMembership({ organizationId: orgA.id, userId: user.id, role: 'owner' });
    db.upsertOrganizationMembership({ organizationId: orgB.id, userId: user.id, role: 'member' });

    const rows = (await import('../src/lib/admin-db-server')).getDb()
      .prepare('SELECT organization_id, role FROM organization_memberships WHERE user_id = ? ORDER BY organization_id')
      .all(user.id) as Array<{ organization_id: string; role: string }>;

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.organization_id)).toEqual(expect.arrayContaining([orgA.id, orgB.id]));
    expect(rows.find((r) => r.organization_id === orgA.id)?.role).toBe('owner');
    expect(rows.find((r) => r.organization_id === orgB.id)?.role).toBe('member');
  });
});
