import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const requireAdminMock = vi.hoisted(() => vi.fn());
const listUsersMock = vi.hoisted(() => vi.fn());
const createUserMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());
const updateUserMock = vi.hoisted(() => vi.fn());
const deleteUserMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-guard', () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock('@/lib/admin-db', () => ({
  listUsers: listUsersMock,
  createUser: createUserMock,
  getUser: getUserMock,
  updateUser: updateUserMock,
  deleteUser: deleteUserMock,
}));

import { GET as listUsersRoute, POST as createUserRoute } from '../src/app/api/admin/users/route';
import { DELETE as deleteUserRoute, GET as getUserRoute, PUT as updateUserRoute } from '../src/app/api/admin/users/[id]/route';

describe('/api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'admin@example.com' });
  });

  it('lists users for authenticated admins', async () => {
    listUsersMock.mockReturnValue([{ id: 'user-1', email: 'user@example.com', name: 'User One', role: 'user' }]);

    const res = await listUsersRoute();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([{ id: 'user-1', email: 'user@example.com', name: 'User One', role: 'user' }]);
  });

  it('creates a new user when email and name are provided', async () => {
    createUserMock.mockReturnValue({ id: 'user-2', email: 'new@example.com', name: 'New User', role: 'admin' });

    const req = new Request('http://localhost/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@example.com', name: 'New User', role: 'admin' }),
    }) as unknown as NextRequest;

    const res = await createUserRoute(req);

    expect(res.status).toBe(201);
    expect(createUserMock).toHaveBeenCalledWith({
      email: 'new@example.com',
      name: 'New User',
      role: 'admin',
    });
  });

  it('rejects user creation without email and name', async () => {
    const req = new Request('http://localhost/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '' }),
    }) as unknown as NextRequest;

    const res = await createUserRoute(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'email and name are required' });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it('returns 401 when listing users without authentication', async () => {
    requireAdminMock.mockRejectedValueOnce(new Error('UNAUTHENTICATED'));

    const res = await listUsersRoute();

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Not authenticated' });
  });

  it('returns 403 when creating users without admin privileges', async () => {
    requireAdminMock.mockRejectedValueOnce(new Error('FORBIDDEN'));

    const req = new Request('http://localhost/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@example.com', name: 'New User' }),
    }) as unknown as NextRequest;

    const res = await createUserRoute(req);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it('returns 500 when user creation fails unexpectedly', async () => {
    createUserMock.mockImplementationOnce(() => {
      throw new Error('db offline');
    });

    const req = new Request('http://localhost/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@example.com', name: 'New User' }),
    }) as unknown as NextRequest;

    const res = await createUserRoute(req);

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to create user' });
  });
});

describe('/api/admin/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'admin@example.com' });
  });

  it('fetches a single user by id', async () => {
    getUserMock.mockReturnValue({ id: 'user-1', email: 'user@example.com', name: 'User One', role: 'user' });

    const res = await getUserRoute({} as NextRequest, { params: Promise.resolve({ id: 'user-1' }) });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: 'user-1', email: 'user@example.com', name: 'User One', role: 'user' });
  });

  it('returns 404 when fetching a missing user', async () => {
    getUserMock.mockReturnValue(undefined);

    const res = await getUserRoute({} as NextRequest, { params: Promise.resolve({ id: 'missing' }) });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Not found' });
  });

  it('updates a user record', async () => {
    updateUserMock.mockReturnValue({ id: 'user-1', email: 'user@example.com', name: 'Updated User', role: 'admin' });

    const req = new Request('http://localhost/api/admin/users/user-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated User', role: 'admin' }),
    }) as unknown as NextRequest;

    const res = await updateUserRoute(req, { params: Promise.resolve({ id: 'user-1' }) });

    expect(res.status).toBe(200);
    expect(updateUserMock).toHaveBeenCalledWith('user-1', { name: 'Updated User', role: 'admin' });
  });

  it('returns 404 when updating a missing user', async () => {
    updateUserMock.mockReturnValue(undefined);

    const req = new Request('http://localhost/api/admin/users/missing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    }) as unknown as NextRequest;

    const res = await updateUserRoute(req, { params: Promise.resolve({ id: 'missing' }) });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Not found' });
  });

  it('deletes an existing user', async () => {
    deleteUserMock.mockReturnValue(true);

    const res = await deleteUserRoute({} as NextRequest, { params: Promise.resolve({ id: 'user-1' }) });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(deleteUserMock).toHaveBeenCalledWith('user-1');
  });

  it('returns 404 when deleting a missing user', async () => {
    deleteUserMock.mockReturnValue(false);

    const res = await deleteUserRoute({} as NextRequest, { params: Promise.resolve({ id: 'missing' }) });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Not found' });
  });

  it('returns 500 when a user update fails unexpectedly', async () => {
    updateUserMock.mockImplementationOnce(() => {
      throw new Error('db offline');
    });

    const req = new Request('http://localhost/api/admin/users/user-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    }) as unknown as NextRequest;

    const res = await updateUserRoute(req, { params: Promise.resolve({ id: 'user-1' }) });

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to update' });
  });

  it('returns 401 when deleting a user without authentication', async () => {
    requireAdminMock.mockRejectedValueOnce(new Error('UNAUTHENTICATED'));

    const res = await deleteUserRoute({} as NextRequest, { params: Promise.resolve({ id: 'user-1' }) });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Not authenticated' });
  });
});
