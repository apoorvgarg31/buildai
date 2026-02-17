import { NextRequest, NextResponse } from 'next/server';
import { getConnection, getConnectionSecrets, updateConnection } from '@/lib/admin-db';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conn = getConnection(id);
  if (!conn) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const config = JSON.parse(conn.config);
  const secrets = getConnectionSecrets(id);

  try {
    let message = '';

    switch (conn.type) {
      case 'database': {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        const host = config.host || config.DB_HOST || '';
        const port = config.port || config.DB_PORT || '5432';
        const dbName = config.dbName || config.DB_NAME || 'postgres';
        const user = secrets?.username || secrets?.DB_USER || '';
        const password = secrets?.password || secrets?.DB_PASSWORD || '';

        // Build psql args (skip -h for local socket, skip -U if empty)
        const args = [];
        if (host) args.push(`-h ${host}`);
        if (port && host) args.push(`-p ${port}`);
        if (user) args.push(`-U ${user}`);
        args.push(`-d ${dbName}`);
        args.push(`-c "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public'" --tuples-only --no-align`);

        const env = { ...process.env, PGPASSWORD: password };
        const result = await execAsync(`psql ${args.join(' ')}`, { env, timeout: 10000 });
        const tableCount = result.stdout.trim();
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
}
