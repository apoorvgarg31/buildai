import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const listConnectionsMock = vi.hoisted(() => vi.fn());
const createConnectionMock = vi.hoisted(() => vi.fn());
const getConnectionMock = vi.hoisted(() => vi.fn());
const updateConnectionMock = vi.hoisted(() => vi.fn());
const deleteConnectionMock = vi.hoisted(() => vi.fn());
const requireAdminMock = vi.hoisted(() => vi.fn());
const actorOrgIdsMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/admin-db', () => ({
  listConnections: listConnectionsMock,
  createConnection: createConnectionMock,
  getConnection: getConnectionMock,
  updateConnection: updateConnectionMock,
  deleteConnection: deleteConnectionMock,
}));

vi.mock('@/lib/api-guard', () => ({
  requireAdmin: requireAdminMock,
  actorOrgIds: actorOrgIdsMock,
}));

import { GET as listRoute, POST as createRoute } from '../src/app/api/admin/connections/route';
import { GET as getRoute, PUT as updateRoute } from '../src/app/api/admin/connections/[id]/route';

describe('admin connection org scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({
      userId: 'admin-1',
      role: 'admin',
      orgId: 'org-a',
      isSuperadmin: false,
    });
    actorOrgIdsMock.mockReturnValue(['org-a']);
  });

  it('lists only the actor org connections for non-superadmins', async () => {
    listConnectionsMock.mockReturnValue([{ id: 'conn-1', org_id: 'org-a' }]);

    const res = await listRoute();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(listConnectionsMock).toHaveBeenCalledWith({ orgIds: ['org-a'], includeUnscoped: false });
    expect(data).toEqual([{ id: 'conn-1', org_id: 'org-a' }]);
  });

  it('forces POSTed connections into the actor org for non-superadmins', async () => {
    createConnectionMock.mockReturnValue({ id: 'conn-1', org_id: 'org-a', config: '{}' });

    const req = {
      json: vi.fn(async () => ({
        name: 'ERP',
        type: 'procore',
        orgId: 'org-b',
        config: { clientId: 'public-id', clientSecret: 'plaintext-secret' },
      })),
    } as unknown as NextRequest;

    const res = await createRoute(req);

    expect(res.status).toBe(201);
    expect(createConnectionMock).toHaveBeenCalledWith({
      orgId: 'org-a',
      name: 'ERP',
      type: 'procore',
      config: { clientId: 'public-id', clientSecret: 'plaintext-secret' },
      secrets: undefined,
    });
  });

  it('blocks detail access to connections outside the actor org', async () => {
    getConnectionMock.mockReturnValue({
      id: 'conn-2',
      org_id: 'org-b',
      config: '{}',
    });

    const res = await getRoute({} as NextRequest, { params: Promise.resolve({ id: 'conn-2' }) });

    expect(res.status).toBe(403);
  });

  it('strips org reassignment on update for non-superadmins', async () => {
    getConnectionMock.mockReturnValue({
      id: 'conn-1',
      org_id: 'org-a',
      config: '{}',
    });
    updateConnectionMock.mockReturnValue({
      id: 'conn-1',
      org_id: 'org-a',
      config: '{}',
    });

    const req = {
      json: vi.fn(async () => ({
        name: 'ERP 2',
        orgId: 'org-b',
      })),
    } as unknown as NextRequest;

    const res = await updateRoute(req, { params: Promise.resolve({ id: 'conn-1' }) });

    expect(res.status).toBe(200);
    expect(updateConnectionMock).toHaveBeenCalledWith('conn-1', { name: 'ERP 2' });
  });
});
