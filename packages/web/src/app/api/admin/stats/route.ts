import { NextResponse } from 'next/server';
import { listUsers, listConnections, listAgents } from '@/lib/admin-db';

export async function GET() {
  try {
    const users = listUsers();
    const connections = listConnections();
    const agents = listAgents();

    return NextResponse.json({
      users: { total: users.length, admins: users.filter(u => u.role === 'admin').length },
      connections: { total: connections.length, connected: connections.filter(c => c.status === 'connected').length },
      agents: { total: agents.length, active: agents.filter(a => a.status === 'active').length },
      recentUsers: users.slice(0, 5),
      recentConnections: connections.slice(0, 5),
    });
  } catch (err) {
    console.error('Stats error:', err);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}
