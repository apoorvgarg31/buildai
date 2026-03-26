import { execFile } from 'child_process';
import { NextRequest, NextResponse } from 'next/server';
import { getConnection, getConnectionSecrets, updateConnection } from '@/lib/admin-db';
import { actorOrgIds, requireAdmin } from '@/lib/api-guard';

function readConfigValue(config: Record<string, unknown>, primaryKey: string, fallbackKey: string, defaultValue = ''): string {
  const value = config[primaryKey] ?? config[fallbackKey] ?? defaultValue;
  return typeof value === 'string' ? value : String(value);
}

async function runPsql(args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return await new Promise((resolve, reject) => {
    execFile('psql', args, { env, timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin();
    const { id } = await params;
    const conn = getConnection(id);
    if (!conn) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!actor.isSuperadmin && (!conn.org_id || !actorOrgIds(actor).includes(conn.org_id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const config = JSON.parse(conn.config);
    const secrets = getConnectionSecrets(id);

    try {
      let message = '';

      switch (conn.type) {
        case 'database': {
          const host = readConfigValue(config, 'host', 'DB_HOST');
          const port = readConfigValue(config, 'port', 'DB_PORT', '5432');
          const dbName = readConfigValue(config, 'dbName', 'DB_NAME', 'postgres');
          const user = readConfigValue(secrets ?? {}, 'username', 'DB_USER');
          const password = readConfigValue(secrets ?? {}, 'password', 'DB_PASSWORD');

          if (!/^\d+$/.test(port)) {
            throw new Error('Invalid database port');
          }

          const args = [
            '--no-psqlrc',
            '--tuples-only',
            '--no-align',
            '--command',
            "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public'",
          ];
          if (host) args.push(`--host=${host}`);
          args.push(`--port=${port}`);
          if (user) args.push(`--username=${user}`);
          args.push(`--dbname=${dbName}`);

          const env = { ...process.env, PGPASSWORD: password };
          const stdout = await runPsql(args, env);
          const tableCount = stdout.trim();
          message = `Connected! ${tableCount} tables found in public schema.`;
          break;
        }
        case 'procore': {
          message = 'Procore connection test not yet implemented (needs OAuth flow).';
          break;
        }
        default: {
          message = `Connection test for type "${conn.type}" not yet implemented.`;
        }
      }

      updateConnection(id, { status: 'connected' });
      return NextResponse.json({ ok: true, message });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      updateConnection(id, { status: 'error' });
      return NextResponse.json({ ok: false, message: `Connection failed: ${errMsg}` });
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to test connection' }, { status: 500 });
  }
}
