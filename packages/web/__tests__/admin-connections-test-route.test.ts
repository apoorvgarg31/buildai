import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const execFileMock = vi.hoisted(() => vi.fn());
const getConnectionMock = vi.hoisted(() => vi.fn());
const getConnectionSecretsMock = vi.hoisted(() => vi.fn());
const updateConnectionMock = vi.hoisted(() => vi.fn());
const requireAdminMock = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({
  execFile: execFileMock,
  default: { execFile: execFileMock },
}));

vi.mock('@/lib/admin-db', () => ({
  getConnection: getConnectionMock,
  getConnectionSecrets: getConnectionSecretsMock,
  updateConnection: updateConnectionMock,
}));

vi.mock('@/lib/api-guard', () => ({
  requireAdmin: requireAdminMock,
}));

import { POST as testConnection } from '../src/app/api/admin/connections/[id]/test/route';

describe('admin connection test route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ userId: 'admin-1', role: 'admin', email: 'admin@example.com' });
    getConnectionMock.mockReturnValue({
      id: 'conn-1',
      type: 'database',
      config: JSON.stringify({
        host: 'db.example.com',
        port: '5432',
        dbName: 'postgres',
      }),
    });
    getConnectionSecretsMock.mockReturnValue({
      username: 'postgres',
      password: 'secret',
    });
    execFileMock.mockImplementation((_file, _args, _options, callback) => {
      callback?.(null, '7\n', '');
      return {} as never;
    });
  });

  it('invokes psql with argument arrays instead of a shell command string', async () => {
    getConnectionMock.mockReturnValueOnce({
      id: 'conn-1',
      type: 'database',
      config: JSON.stringify({
        host: "db.example.com; touch /tmp/pwned",
        port: '5432',
        dbName: 'postgres$(touch /tmp/pwned)',
      }),
    });
    getConnectionSecretsMock.mockReturnValueOnce({
      username: 'postgres && whoami',
      password: 'secret',
    });

    const res = await testConnection({} as NextRequest, { params: Promise.resolve({ id: 'conn-1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(execFileMock).toHaveBeenCalledWith(
      'psql',
      [
        '--no-psqlrc',
        '--tuples-only',
        '--no-align',
        '--command',
        "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public'",
        '--host=db.example.com; touch /tmp/pwned',
        '--port=5432',
        '--username=postgres && whoami',
        '--dbname=postgres$(touch /tmp/pwned)',
      ],
      expect.objectContaining({
        timeout: 10000,
        env: expect.objectContaining({ PGPASSWORD: 'secret' }),
      }),
      expect.any(Function)
    );
    expect(updateConnectionMock).toHaveBeenCalledWith('conn-1', { status: 'connected' });
  });

  it('rejects non-numeric database ports before spawning psql', async () => {
    getConnectionMock.mockReturnValueOnce({
      id: 'conn-1',
      type: 'database',
      config: JSON.stringify({
        host: 'db.example.com',
        port: '5432; touch /tmp/pwned',
        dbName: 'postgres',
      }),
    });

    const res = await testConnection({} as NextRequest, { params: Promise.resolve({ id: 'conn-1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(false);
    expect(data.message).toContain('Invalid database port');
    expect(execFileMock).not.toHaveBeenCalled();
    expect(updateConnectionMock).toHaveBeenCalledWith('conn-1', { status: 'error' });
  });
});
